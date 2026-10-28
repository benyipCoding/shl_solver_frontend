import { NextRequest } from "next/server";
import { proxyMarketMasterPost } from "../../_proxy";

export async function POST(request: NextRequest) {
  return proxyMarketMasterPost(
    request,
    "/market_master/sync/queue",
    "加入采集队列失败"
  );
}
