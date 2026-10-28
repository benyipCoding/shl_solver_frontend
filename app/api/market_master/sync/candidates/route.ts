import { NextRequest } from "next/server";
import { proxyMarketMasterGet } from "../../_proxy";

export async function GET(request: NextRequest) {
  return proxyMarketMasterGet(
    request,
    "/market_master/sync/candidates",
    "获取候选品种失败"
  );
}
