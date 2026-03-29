import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = searchParams.get("skip") || "0";
    const limit = searchParams.get("limit") || "100";
    const res = await apiClient.get(
      `/user/credit-logs?skip=${skip}&limit=${limit}`
    );
    return NextResponse.json(res.data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "获取算力记录失败" },
      { status: error.response?.status || error.status || 500 }
    );
  }
}
