import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function harness(env, respond = () => Response.json({status:"confirmed"})) {
  const exports={}, calls=[];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../../app/api/market_master/trading/[...path]/route.ts",import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText,{exports,Response,Headers,Buffer,process:{env},require:()=>({NextResponse:{json:(body,init)=>Response.json(body,init)}}),
    fetch:async(url,options)=>{calls.push({url,options:{...options,headers:new Headers(options.headers)}});return respond(url,options,calls.length);}});
  const request=(method,origin,cookie="access_token=test",path="commands",headers={})=>{
    const url=`http://localhost:3000/api/market_master/trading/${path}`;
    return Object.assign(new Request(url,{
      method,headers:{...(origin?{origin}:{}),cookie,...headers},...(method==="POST"?{body:JSON.stringify({client_id:"same-id",action:"open",amount:1000})}:{})}),
      {nextUrl:new URL(url)});
  };
  return {exports,calls,request,context:{params:Promise.resolve({path:["commands"]})}};
}
test("production trading routes do not contact the backend even with configured flags",async()=>{
  const h=harness({NODE_ENV:"production",API_BASE_URL:"http://localhost:8000/api_v1"});
  assert.equal((await h.exports.POST(h.request("POST","http://localhost:3000"),h.context)).status,404);
  assert.equal((await h.exports.GET(h.request("GET"),h.context)).status,404);
  assert.equal(h.calls.length,0);
});
test("trade writes require same origin and preserve the command ID and login cookie",async()=>{
  const h=harness({NODE_ENV:"development",API_BASE_URL:"http://localhost:8000/api_v1"});
  assert.equal((await h.exports.POST(h.request("POST","https://other.example"),h.context)).status,403);
  assert.equal(h.calls.length,0);
  assert.equal((await h.exports.POST(h.request("POST","http://localhost:3000"),h.context)).status,200);
  assert.equal(JSON.parse(h.calls[0].options.body).client_id,"same-id");
  assert.equal(h.calls[0].options.headers.get("cookie"),"access_token=test");
});

const env = {NODE_ENV:"development",API_BASE_URL:"http://localhost:8000/api_v1"};
const context = path => ({params:Promise.resolve({path:path.split("/")})});
const token = expires => `header.${Buffer.from(JSON.stringify({exp:expires})).toString("base64url")}.signature`;
const refreshedCookie = "access_token=new-access; HttpOnly; Path=/; Max-Age=3600; SameSite=lax";
const refreshResponse = () => Response.json({message:"refreshed"},{headers:{"Set-Cookie":refreshedCookie}});

test("switching to realtime renews an expired or missing access cookie before querying state",async()=>{
  for (const cookie of ["refresh_token=refresh", `access_token=${token(1)}; refresh_token=refresh`]) {
    const h=harness(env,url=>url.endsWith("/auth/refresh") ? refreshResponse() : Response.json({type:"account"}));
    const response=await h.exports.GET(h.request("GET",null,cookie,"state?symbol=XAU%2FUSD"),context("state"));
    assert.equal(response.status,200);
    assert.deepEqual(h.calls.map(r=>r.url),[
      "http://localhost:8000/api_v1/auth/refresh",
      "http://localhost:8000/api_v1/market_master/trading/state?symbol=XAU%2FUSD",
    ]);
    assert.equal(h.calls[0].options.headers.get("cookie"),cookie);
    assert.match(h.calls[1].options.headers.get("cookie"),/access_token=new-access/);
    assert.match(h.calls[1].options.headers.get("cookie"),/refresh_token=refresh/);
    assert.deepEqual(response.headers.getSetCookie(),[refreshedCookie]);
    assert.equal((await response.json()).type,"account");
  }
});

test("valid login and bearer authentication go straight to the backend",async()=>{
  for (const [cookie,headers] of [
    [`access_token=${token(Math.floor(Date.now()/1000)+3600)}; refresh_token=refresh`,{}],
    ["",{authorization:"Bearer test-bearer"}],
  ]) {
    const h=harness(env);
    const response=await h.exports.GET(h.request("GET",null,cookie,"state",headers),context("state"));
    assert.equal(response.status,200);
    assert.equal(h.calls.length,1);
    assert.ok(h.calls[0].url.endsWith("/trading/state"));
    assert.equal(h.calls[0].options.headers.get("cookie"),cookie);
    if(headers.authorization) assert.equal(h.calls[0].options.headers.get("authorization"),headers.authorization);
  }
});

test("a rejected credential is refreshed once and the original command body and ID survive retry",async()=>{
  const h=harness(env,(url,_options,index)=>url.endsWith("/auth/refresh") ? refreshResponse() :
    index===1 ? Response.json({detail:"Unauthorized"},{status:401}) : Response.json({status:"confirmed"}));
  const response=await h.exports.POST(h.request("POST","http://localhost:3000","access_token=old; refresh_token=refresh"),h.context);
  assert.equal(response.status,200);
  assert.equal(h.calls.length,3);
  assert.equal(h.calls[0].options.body,h.calls[2].options.body);
  assert.equal(JSON.parse(h.calls[2].options.body).client_id,"same-id");
  assert.equal(h.calls[0].options.headers.get("cookie"),"access_token=old; refresh_token=refresh");
  assert.equal(h.calls[2].options.headers.get("cookie"),"access_token=new-access; refresh_token=refresh");
  assert.deepEqual(response.headers.getSetCookie(),[refreshedCookie]);
});

test("anonymous and expired refresh sessions stop without forwarding a trade or looping",async()=>{
  const anonymous=harness(env);
  assert.equal((await anonymous.exports.GET(anonymous.request("GET",null,"","state"),context("state"))).status,401);
  assert.equal(anonymous.calls.length,0);
  const invalid=harness(env,()=>Response.json({detail:"Token失效"},{status:401}));
  assert.equal((await invalid.exports.GET(invalid.request("GET",null,"refresh_token=expired","state"),context("state"))).status,401);
  assert.equal(invalid.calls.length,1);
  assert.ok(invalid.calls[0].url.endsWith("/auth/refresh"));
  const stillUnauthorized=harness(env,url=>url.endsWith("/auth/refresh") ? refreshResponse() : Response.json({}, {status:401}));
  assert.equal((await stillUnauthorized.exports.GET(stillUnauthorized.request("GET",null,"access_token=old; refresh_token=refresh","state"),context("state"))).status,401);
  assert.equal(stillUnauthorized.calls.length,3);
});

test("permission failures, backend errors and uncertain network outcomes never replay commands",async()=>{
  for (const status of [403,500,502]) {
    const h=harness(env,()=>Response.json({detail:"failed"},{status}));
    assert.equal((await h.exports.POST(h.request("POST","http://localhost:3000","access_token=test; refresh_token=refresh"),h.context)).status,status);
    assert.equal(h.calls.length,1);
  }
  const h=harness(env,()=>{throw new Error("connection lost");});
  assert.equal((await h.exports.POST(h.request("POST","http://localhost:3000"),h.context)).status,502);
  assert.equal(h.calls.length,1);
});

test("refresh cookies are returned before an account stream completes, without buffering events",async()=>{
  let controller;
  const stream=new ReadableStream({start(c){controller=c;c.enqueue(new TextEncoder().encode('data: {"type":"account"}\n\n'));}});
  const h=harness(env,url=>url.endsWith("/auth/refresh") ? refreshResponse() : new Response(stream,{headers:{"Content-Type":"text/event-stream"}}));
  const request=h.request("GET",null,"refresh_token=refresh","stream?symbol=XAU%2FUSD");
  const response=await h.exports.GET(request,context("stream"));
  assert.equal(response.headers.get("content-type"),"text/event-stream");
  assert.deepEqual(response.headers.getSetCookie(),[refreshedCookie]);
  assert.equal(h.calls[1].options.signal,request.signal);
  const reader=response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value),/"type":"account"/);
  controller.close();
  assert.equal((await reader.read()).done,true);
});

test("a refresh response without an access cookie cannot trigger another command",async()=>{
  const h=harness(env,()=>Response.json({message:"ok"}));
  assert.equal((await h.exports.POST(h.request("POST","http://localhost:3000","refresh_token=refresh"),h.context)).status,401);
  assert.equal(h.calls.length,1);
  assert.ok(h.calls[0].url.endsWith("/auth/refresh"));
});
