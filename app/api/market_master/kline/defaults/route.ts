import { NextRequest, NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params = Object.fromEntries(searchParams.entries());

  if (!params.symbol) {
    return NextResponse.json({ error: "缺少 symbol 参数" }, { status: 400 });
  }

  try {
    const res = await apiClient.get("/market_master/kline/defaults", {
      params,
    });
    return NextResponse.json(res.data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          "获取 K 线数据失败",
      },
      { status: error.response?.status || error.status || 500 }
    );
  }
}
