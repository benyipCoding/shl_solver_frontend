import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCookies(header: string) {
  return new Map(header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [] : [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]];
  }));
}

function accessTokenNeedsRefresh(token: string | undefined) {
  if (!token) return true;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    // Expiry is only a refresh hint. The backend still verifies the signature
    // and checks the user's permissions on every trading request.
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now() + 30000;
  } catch {
    return false;
  }
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (request.method === "POST" && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "只允许当前页面提交交易" }, { status: 403 });
  }
  const { path } = await context.params;
  const action = path.join("/");
  if (!/^(state|stream|commands(?:\/[\da-f-]{36})?)$/.test(action)) return new Response(null, { status: 404 });
  const base = process.env.API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!base) return NextResponse.json({ error: "缺少本地后端配置" }, { status: 503 });
  const cookies = readCookies(request.headers.get("cookie") || "");
  const authorization = request.headers.get("authorization");
  if (!cookies.get("access_token") && !cookies.get("refresh_token") && !authorization) {
    return NextResponse.json({ error: "登录已失效，请重新登录后连接福汇 Demo" }, { status: 401 });
  }
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization) headers.set("authorization", authorization);
  const updateCookieHeader = () => headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
  updateCookieHeader();
  const setCookies: string[] = [];
  const respond = (response: Response) => {
    const outgoing = new Headers({
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
    });
    for (const cookie of [...setCookies, ...response.headers.getSetCookie()]) {
      outgoing.append("Set-Cookie", cookie);
    }
    // Pass the body through so account events remain a live stream.
    return new Response(response.body, { status: response.status, headers: outgoing });
  };
  const backend = base.replace(/\/$/, "");
  let refreshed = false;
  const refresh = async (): Promise<Response | null> => {
    refreshed = true;
    const response = await fetch(`${backend}/auth/refresh`, {
      method: "POST", headers, cache: "no-store", signal: request.signal,
    });
    if (!response.ok) return response;
    const renewedCookies = response.headers.getSetCookie();
    const renewed = new Map(renewedCookies.flatMap((cookie) => [...readCookies(cookie.split(";")[0])]));
    await response.body?.cancel();
    if (!renewed.get("access_token")) {
      return NextResponse.json({ error: "登录续期失败，请重新登录后连接福汇 Demo" }, { status: 401 });
    }
    for (const [key, value] of renewed) cookies.set(key, value);
    setCookies.push(...renewedCookies);
    updateCookieHeader();
    return null;
  };
  try {
    // Refresh before the first account query if the browser has already dropped
    // the access cookie, or it is about to expire during a mode switch.
    if (cookies.get("refresh_token") && (!authorization || cookies.get("access_token")) && accessTokenNeedsRefresh(cookies.get("access_token"))) {
      const failure = await refresh();
      if (failure) return respond(failure);
    }
    const body = request.method === "POST" ? await request.text() : undefined;
    const forward = () => fetch(`${backend}/market_master/trading/${action}${request.nextUrl.search}`, {
      method: request.method,
      headers, body,
      cache: "no-store", signal: request.signal,
    });
    let response = await forward();
    if (response.status === 401 && !refreshed && cookies.get("refresh_token")) {
      await response.body?.cancel();
      const failure = await refresh();
      if (failure) return respond(failure);
      // A 401 is rejected before execution. Retry once with the identical body
      // and command ID; never replay a timeout, a network error or a 5xx.
      response = await forward();
    }
    return respond(response);
  } catch {
    return respond(NextResponse.json({ error: "交易连接中断，请核对原指令结果，不要重复提交" }, { status: 502 }));
  }
}

export const GET = proxy;
export const POST = proxy;
