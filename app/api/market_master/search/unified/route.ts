import { NextRequest, NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params = Object.fromEntries(searchParams.entries());

  if (!params.keyword) {
    return NextResponse.json({ error: "缺少 keyword 参数" }, { status: 400 });
  }

  try {
    const res = await apiClient.get("/market_master/search/unified", {
      params,
    });

    return NextResponse.json(res.data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          "搜索交易标的失败",
      },
      { status: error.response?.status || error.status || 500 }
    );
  }
}
