import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function harness(env) {
  const exports={}, calls=[];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../../app/api/market_master/trading/[...path]/route.ts",import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText,{exports,Response,process:{env},require:()=>({NextResponse:{json:(body,init)=>Response.json(body,init)}}),
    fetch:async(url,options)=>{calls.push({url,options});return Response.json({status:"confirmed"});}});
  const request=(method,origin)=>Object.assign(new Request("http://localhost:3000/api/market_master/trading/commands",{
    method,headers:{...(origin?{origin}:{}),cookie:"access_token=test"},...(method==="POST"?{body:JSON.stringify({client_id:"same-id"})}:{})}),
    {nextUrl:new URL("http://localhost:3000/api/market_master/trading/commands")});
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
  assert.equal(h.calls[0].options.headers.cookie,"access_token=test");
});
