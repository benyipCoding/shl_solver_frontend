import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET() {
  try {
    const res = await apiClient.get("/user/balance");
    return NextResponse.json(res.data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "获取算力余额失败" },
      { status: error.response?.status || error.status || 500 }
    );
  }
}
