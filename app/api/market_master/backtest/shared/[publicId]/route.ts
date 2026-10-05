import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { backtestShareError } from "../../share-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const response = await apiClient.get(`/market_master/backtest/shared/${encodeURIComponent(publicId)}`);
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = backtestShareError(error, "加载分享回放失败");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const response = await apiClient.post(`/market_master/backtest/shared/${encodeURIComponent(publicId)}`);
    return NextResponse.json(response.data);
  } catch (error) {
    return backtestShareError(error, "收藏分享记录失败");
  }
}
