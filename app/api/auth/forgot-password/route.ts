import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ message: "邮箱是必填项" }, { status: 400 });
    }

    const backendResponse = await apiClient.post("/auth/forgot-password", {
      email,
    });

    // Axios 自动解析 JSON
    const data = backendResponse.data;

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.response) {
      return NextResponse.json(
        { message: error.response.data?.detail || "发送重置链接失败" },
        { status: error.response.status }
      );
    } else if (error.request) {
      console.error("No response received:", error.request);
      return NextResponse.json(
        { message: "无法连接到服务器" },
        { status: 504 }
      );
    } else {
      console.error("Request setup error:", error.message);
      return NextResponse.json(
        { message: error.message || "请求配置错误" },
        { status: 500 }
      );
    }
  }
}
