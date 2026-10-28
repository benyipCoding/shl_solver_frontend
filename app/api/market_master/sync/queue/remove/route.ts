import { NextRequest } from "next/server";
import { proxyMarketMasterPost } from "../../../_proxy";

export async function POST(request: NextRequest) {
  return proxyMarketMasterPost(
    request,
    "/market_master/sync/queue/remove",
    "移出采集队列失败"
  );
}
