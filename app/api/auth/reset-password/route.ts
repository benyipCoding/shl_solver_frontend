import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, new_password, confirm_password } = body;

    if (!token || !new_password || !confirm_password) {
      return NextResponse.json({ message: "缺少必要参数" }, { status: 400 });
    }

    if (new_password !== confirm_password) {
      return NextResponse.json(
        { message: "两次输入的密码不一致" },
        { status: 400 }
      );
    }

    const backendResponse = await apiClient.post("/auth/reset-password", {
      token,
      new_password,
      confirm_password,
    });

    const data = backendResponse.data;

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.response) {
      return NextResponse.json(
        { message: error.response.data?.detail || "密码重置失败" },
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
