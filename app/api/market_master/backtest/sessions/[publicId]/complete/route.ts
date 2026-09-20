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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const body = await request.json().catch(() => ({}));
    const res = await apiClient.post(
      `/market_master/backtest/sessions/${publicId}/complete`,
      body || {}
    );
    return NextResponse.json(res.data);
  } catch (error: any) {
    return toErrorResponse(error, "结束回测场次失败");
  }
}
