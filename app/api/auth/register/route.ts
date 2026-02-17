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

    return response;
  } catch (error: any) {
    let errMsg = "注册失败";
    return NextResponse.json({ error: errMsg }, { status: error.status });
  }
}
