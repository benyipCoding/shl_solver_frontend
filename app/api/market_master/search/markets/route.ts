import { NextRequest } from "next/server";
import { proxyMarketMasterGet } from "../../_proxy";

export async function GET(request: NextRequest) {
  return proxyMarketMasterGet(
    request,
    "/market_master/search/markets",
    "获取热门品类失败"
  );
}
