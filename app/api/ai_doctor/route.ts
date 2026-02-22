import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { AnalyzePayload } from "@/interfaces/ai_doctor";

export async function POST(request: Request) {
  const data: AnalyzePayload = await request.json();
  try {
    const res = await apiClient.post("/ai_doctor/analyze", data, {
      timeout: 0,
    });
    const responseData = res.data;
    return NextResponse.json(responseData);
  } catch (error: any) {
    let errMsg = "图片解析失败";

    if (error.status === 429) {
      errMsg = "请求过于频繁，请稍后再试。";
    }

    return NextResponse.json({ error: errMsg }, { status: error.status });
  }
}
