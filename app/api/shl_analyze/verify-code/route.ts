import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { SHLCodeVerifyPayload } from "@/interfaces/shl_solver";

// 代码视觉比对接口
export async function POST(request: Request) {
  try {
    const payload: SHLCodeVerifyPayload = await request.json();

    // 请求后端 SHL 代码比对接口
    const res = await apiClient
      .post("/shl_analyze/verify-code", payload, { timeout: 0 })
      .then((res) => res.data);

    if (res.code !== 200) {
      // 后端返回错误
      return NextResponse.json(
        { error: res.message || "代码比对失败" },
        { status: res.code }
      );
    }

    // 返回比对结果给前端
    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.status === 429) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.detail || "代码比对失败" },
      { status: error.status || 500 }
    );
  }
}
