import { NextRequest } from "next/server";
import { proxyAdminGet } from "@/app/api/admin/_utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params;
  return proxyAdminGet(
    request,
    `/admin/token-records/${recordId}`,
    "获取 Token 记录详情失败"
  );
}
