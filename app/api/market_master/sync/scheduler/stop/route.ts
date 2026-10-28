import { NextRequest } from "next/server";
import { proxyMarketMasterPost } from "../../../_proxy";

export async function POST(request: NextRequest) {
  return proxyMarketMasterPost(
    request,
    "/market_master/sync/scheduler/stop",
    "停止定时采集失败"
  );
}
