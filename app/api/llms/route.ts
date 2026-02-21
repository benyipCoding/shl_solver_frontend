import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

// LLM列表接口
export async function GET(request: Request) {
  try {
    // 请求后端 LLM 列表接口
    const res = await apiClient.get("/llms").then((res) => res.data);
    if (res.code !== 200) {
      //   后端返回错误
      return NextResponse.json(
        { error: res.message || "获取LLM列表失败" },
        { status: res.code }
      );
    }
    // 返回LLM列表给前端
    return NextResponse.json(res.data);
  } catch (error: any) {
    return NextResponse.json({ error: "获取LLM列表失败" }, { status: 500 });
  }
}
