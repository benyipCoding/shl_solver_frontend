import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { backtestShareError } from "../../../share-error";

type Context = { params: Promise<{ publicId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const { publicId } = await params;
    const response = await apiClient.post(`/market_master/backtest/sessions/${encodeURIComponent(publicId)}/share`);
    return NextResponse.json(response.data);
  } catch (error) {
    return backtestShareError(error, "生成分享链接失败");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { publicId } = await params;
    const response = await apiClient.delete(`/market_master/backtest/sessions/${encodeURIComponent(publicId)}/share`);
    return NextResponse.json(response.data);
  } catch (error) {
    return backtestShareError(error, "停止分享失败");
  }
}
