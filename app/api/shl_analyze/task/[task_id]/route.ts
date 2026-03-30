import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ task_id: string }> }
) {
  try {
    const { task_id } = await params;
    const res = await apiClient
      .get(`/shl_analyze/task/${task_id}`)
      .then((res) => res.data);

    if (res.code !== 200) {
      return NextResponse.json(
        { error: res.message || "获取任务状态失败" },
        { status: res.code }
      );
    }
    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.status === 429) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: error.detail || "获取任务状态失败" },
      { status: error.status || 500 }
    );
  }
}
