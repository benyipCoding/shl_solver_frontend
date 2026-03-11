import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "1";
  const size = searchParams.get("size") || "20";

  try {
    const res = await apiClient
      .get("/shl_history", {
        params: { page, size },
      })
      .then((res) => res.data);

    if (res.code !== 200) {
      return NextResponse.json(
        { error: res.message || "获取历史记录失败" },
        { status: res.code || 500 }
      );
    }

    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.response?.data?.message || "获取历史记录失败" },
      { status: error?.response?.status || 500 }
    );
  }
}
