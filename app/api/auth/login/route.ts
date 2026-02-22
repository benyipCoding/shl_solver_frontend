import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 简单的输入验证
    if (!email || !password) {
      return NextResponse.json(
        { message: "邮箱和密码是必填项" },
        { status: 400 }
      );
    }

    // 转发请求给 Python 后端
    let backendResponse;
    try {
      backendResponse = await apiClient.post("/auth/login", {
        email,
        password,
      });
    } catch (error: any) {
      // Axios 在状态码非 2xx 时会抛出异常
      if (error.response) {
        // 请求已发出，服务器返回状态码不在 2xx 范围内
        return NextResponse.json(
          { message: error.response.data?.message || "登录失败" },
          { status: error.response.status }
        );
      } else if (error.request) {
        // 请求已发出，但没有收到响应
        console.error("No response received:", error.request);
        return NextResponse.json(
          { message: "无法连接到服务器" },
          { status: 504 }
        );
      } else {
        // 设置请求时发生错误
        console.error("Request setup error:", error.message);
        return NextResponse.json(
          { message: error.detail || "请求配置错误" },
          { status: error.status || 500 }
        );
      }
    }

    // Axios 自动解析 JSON，数据在 .data 中
    const data = backendResponse.data;

    // 创建 Next.js 的响应对象
    // Python 后端返回的数据结构是 APIResponse(data=user)，所以这里的 data 就是 user 信息
    const response = NextResponse.json(data, { status: 200 });

    // 处理后端返回的 Set-Cookie 头
    // Axios 在 Node.js 环境中，headers 是对象，set-cookie 是字符串数组
    const setCookieHeader = backendResponse.headers["set-cookie"];

    if (setCookieHeader && Array.isArray(setCookieHeader)) {
      // 将数组形式的 cookie 设置到响应头中
      setCookieHeader.forEach((cookie) => {
        response.headers.append("Set-Cookie", cookie);
      });
    } else if (typeof setCookieHeader === "string") {
      response.headers.set("Set-Cookie", setCookieHeader);
    }

    return response;
  } catch (error: any) {
    console.error("登录路由内部错误:", error);
    return NextResponse.json({ message: "服务器内部错误" }, { status: 500 });
  }
}
