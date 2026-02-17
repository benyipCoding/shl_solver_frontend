import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { LocalAuthPayload } from "@/interfaces/auth";

// 注册接口
export async function POST(request: Request) {
  const data: LocalAuthPayload = await request.json();
  try {
    const res = await apiClient
      .post("/auth/register", data)
      .then((res) => res.data);

    if (res.code === 409) {
      return NextResponse.json({ error: "用户已存在" }, { status: 409 });
    }

    const response = NextResponse.json(res.data);

    // 获取后端返回的 set-cookie 头，并设置到前端响应中
    const setCookie = res.headers["set-cookie"];
    if (setCookie) {
      if (Array.isArray(setCookie)) {
        setCookie.forEach((cookie) => {
          response.headers.append("Set-Cookie", cookie);
        });
      } else if (typeof setCookie === "string") {
        response.headers.set("Set-Cookie", setCookie);
      }
    }

    return response;
  } catch (error: any) {
    let errMsg = "注册失败";
    return NextResponse.json({ error: errMsg }, { status: error.status });
  }
}
