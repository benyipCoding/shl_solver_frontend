import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!["capabilities", "stream", "history"].includes(action)) return new Response(null, { status: 404 });
  if (process.env.NODE_ENV !== "development") {
    return action === "capabilities" ? NextResponse.json({ enabled: false }) : new Response(null, { status: 404 });
  }
  const base = process.env.API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!base) return NextResponse.json({ error: "缺少后端基地址配置" }, { status: 503 });
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/market_master/realtime/${action}${request.nextUrl.search}`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store", signal: request.signal,
    });
    return new Response(response.body, { status: response.status, headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
    } });
  } catch {
    return NextResponse.json({ error: "本地实时行情服务不可用" }, { status: 502 });
  }
}
