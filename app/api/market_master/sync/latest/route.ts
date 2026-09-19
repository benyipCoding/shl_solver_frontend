import { NextRequest, NextResponse } from "next/server";
import { proxyMarketMasterPost } from "../../_proxy";

export async function POST(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const interval = request.nextUrl.searchParams.get("interval")?.trim();

  if (!symbol) {
    return NextResponse.json({ error: "缺少 symbol 参数" }, { status: 400 });
  }
  if (!interval) {
    return NextResponse.json({ error: "缺少 interval 参数" }, { status: 400 });
  }

  return proxyMarketMasterPost(
    request,
    "/market_master/sync/latest",
    "同步最新 K 线失败"
  );
}
