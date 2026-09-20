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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await apiClient.post("/market_master/backtest/sessions", body);
    return NextResponse.json(res.data);
  } catch (error: any) {
    return toErrorResponse(error, "创建回测场次失败");
  }
}
