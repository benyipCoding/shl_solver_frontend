import { NextRequest, NextResponse } from "next/server";
import { proxyMarketMasterGet } from "../../_proxy";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params = Object.fromEntries(searchParams.entries());

  if (!params.symbol) {
    return NextResponse.json({ error: "缺少 symbol 参数" }, { status: 400 });
  }

  return proxyMarketMasterGet(
    request,
    "/market_master/kline/defaults",
    "获取 K 线数据失败"
  );
}
