import { NextRequest } from "next/server";
import { proxyMarketMasterGet } from "../../_proxy";

export async function GET(request: NextRequest) {
  return proxyMarketMasterGet(
    request,
    "/market_master/sync/status",
    "获取同步状态失败"
  );
}
