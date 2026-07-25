import { NextRequest, NextResponse } from "next/server";
import { proxyMarketMasterGet } from "../../_proxy";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params = Object.fromEntries(searchParams.entries());

  if (!params.keyword && !params.market) {
    return NextResponse.json(
      { error: "缺少 keyword 或 market 参数" },
      { status: 400 }
    );
  }

  return proxyMarketMasterGet(
    request,
    "/market_master/search/unified",
    "搜索交易标的失败"
  );
}
