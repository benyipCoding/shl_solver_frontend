import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { LocalAuthPayload } from "@/interfaces/auth";

// 注册接口
export async function POST(request: Request) {
  const data: LocalAuthPayload = await request.json();
  try {
    const res = await apiClient.post("/auth/register", data, {
      headers: {
        "Content-Type": request.headers.get("Content-Type"),
      },
      timeout: 0,
    });
    const responseData = res.data;
    return NextResponse.json(responseData);
  } catch (error: any) {
    let errMsg = "注册失败";
    if (error.status === 409) {
      errMsg = "用户已存在，请直接登录。";
    }
    return NextResponse.json({ error: errMsg }, { status: error.status });
  }
}
