import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { TransformRequest } from "@/interfaces/excel_workbench";

// SHL分析接口
export async function POST(request: Request) {
  try {
    const payload: TransformRequest = await request.json();
    // 请求后端 SHL 分析接口
    const res = await apiClient
      .post("/excel_wb/transform", payload, { timeout: 0 })
      .then((res) => res.data);
    if (res.code !== 200) {
      //   后端返回错误
      return NextResponse.json(
        { error: res.message || "Excel 工作簿处理失败" },
        { status: res.code }
      );
    }
    // 返回分析结果给前端
    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.status === 429) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.detail || "Excel 工作簿处理失败" },
      { status: error.status || 500 }
    );
  }
}
