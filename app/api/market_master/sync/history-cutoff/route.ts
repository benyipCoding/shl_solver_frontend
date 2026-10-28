import { NextRequest } from "next/server";
import { proxyMarketMasterPost } from "../../_proxy";

export async function POST(request: NextRequest) {
  return proxyMarketMasterPost(
    request,
    "/market_master/sync/history-cutoff",
    "设置历史数据截止时间失败"
  );
}
