import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET(request: Request) {
  try {
    const res = await apiClient.get("/shl_history/unread_count");

    if (res.data.code !== 200) {
      return NextResponse.json(
        { error: res.data.message || "请求失败" },
        { status: res.data.code || 500 }
      );
    }

    return NextResponse.json(res.data.data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.response?.data?.message || "Internal Server Error" },
      { status: error?.response?.status || 500 }
    );
  }
}
