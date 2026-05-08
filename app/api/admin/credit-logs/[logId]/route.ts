import { NextRequest } from "next/server";
import { proxyAdminGet } from "@/app/api/admin/_utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;
  return proxyAdminGet(
    request,
    `/admin/credit-logs/${logId}`,
    "获取消费记录详情失败"
  );
}
