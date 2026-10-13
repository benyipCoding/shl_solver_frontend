import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/market_master/trading/${action}${request.nextUrl.search}`, {
      method: request.method,
      headers: { cookie: request.headers.get("cookie") || "", "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store", signal: request.signal,
    });
    return new Response(response.body, { status: response.status, headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
    } });
  } catch {
    return NextResponse.json({ error: "交易连接中断，请核对原指令结果，不要重复提交" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
