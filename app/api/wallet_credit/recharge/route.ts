import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await apiClient.post("/wallet_credit/recharge", body);
    return NextResponse.json(res.data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.data?.detail || error?.detail || "充值算力失败" },
      { status: error.response?.status || error.status || 500 }
    );
  }
}
