import { NextRequest, NextResponse } from "next/server";
import { proxyMarketMasterPost } from "../../_proxy";

export async function POST(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const interval = request.nextUrl.searchParams.get("interval")?.trim();
  const startDate = request.nextUrl.searchParams.get("start_date")?.trim();
  const endDate = request.nextUrl.searchParams.get("end_date")?.trim();

  if (!symbol) {
    return NextResponse.json({ error: "缺少 symbol 参数" }, { status: 400 });
  }
  if (!interval) {
    return NextResponse.json({ error: "缺少 interval 参数" }, { status: 400 });
  }
  if (!startDate) {
    return NextResponse.json({ error: "缺少 start_date 参数" }, { status: 400 });
  }
  if (!endDate) {
    return NextResponse.json({ error: "缺少 end_date 参数" }, { status: 400 });
  }

  return proxyMarketMasterPost(
    request,
    "/market_master/sync/repair",
    "修复框选 K 线失败"
  );
}
