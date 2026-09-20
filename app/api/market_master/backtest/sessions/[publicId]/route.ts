import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

const toErrorResponse = (error: any, fallback: string) => {
  const status = error?.status || error?.response?.status || 500;
  const message =
    error?.message ||
    error?.error ||
    error?.detail ||
    error?.response?.data?.message ||
    fallback;
  return NextResponse.json(
    { error: message, message, code: error?.code || status },
    { status }
  );
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const res = await apiClient.get(
      `/market_master/backtest/sessions/${publicId}`
    );
    return NextResponse.json(res.data);
  } catch (error: any) {
    return toErrorResponse(error, "获取回测详情失败");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const res = await apiClient.delete(
      `/market_master/backtest/sessions/${publicId}`
    );
    return NextResponse.json(res.data);
  } catch (error: any) {
    return toErrorResponse(error, "删除回测记录失败");
  }
}
