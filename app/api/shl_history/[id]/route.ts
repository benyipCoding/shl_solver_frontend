import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const res = await apiClient
      .patch(`/shl_history/${id}`, body)
      .then((res) => res.data);

    if (res.code !== 200) {
      return NextResponse.json(
        { error: res.message || "更新历史记录失败" },
        { status: res.code || 500 }
      );
    }

    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.response?.data?.message || "更新历史记录失败" },
      { status: error?.response?.status || 500 }
    );
  }
}
