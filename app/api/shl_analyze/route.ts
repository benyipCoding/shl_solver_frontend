import { NextResponse } from "next/server";
import apiClient from "@/utils/request";
import { SHLAnalysisPayload } from "@/interfaces/shl_solver";

const getApiErrorMeta = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return {
      detail: "SHL分析失败",
      status: 500,
    };
  }

  const detail =
    "detail" in error && typeof error.detail === "string"
      ? error.detail
      : "SHL分析失败";
  const status =
    "status" in error && typeof error.status === "number" ? error.status : 500;

  return { detail, status };
};

// SHL分析接口
export async function POST(request: Request) {
  try {
    const payload: SHLAnalysisPayload = await request.json();
    // 请求后端 SHL 分析接口
    const res = await apiClient
      .post("/shl_analyze", payload, { timeout: 0 })
      .then((res) => res.data);
    if (res.code !== 200) {
      //   后端返回错误
      return NextResponse.json(
        { error: res.message || "SHL分析失败" },
        { status: res.code }
      );
    }
    // 返回分析结果给前端
    return NextResponse.json(res.data);
  } catch (error: unknown) {
    const { detail, status } = getApiErrorMeta(error);

    if (status === 429) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: detail }, { status });
  }
}
