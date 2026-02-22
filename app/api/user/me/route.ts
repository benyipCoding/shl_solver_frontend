import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

// 获取当前用户信息接口
export async function GET() {
  try {
    const res = await apiClient.get("/user/me");
    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("获取用户信息失败:", error);
    return NextResponse.json(
      { error: "获取用户信息失败" },
      { status: error.response?.status || 500 }
    );
  } finally {
    // 无论成功还是失败，都不返回用户信息
    // 这样前端在用户未登录时会得到 null，而不是一个错误对象
  }
}
