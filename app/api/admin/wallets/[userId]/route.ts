import { NextRequest } from "next/server";
import { proxyAdminGet } from "@/app/api/admin/_utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyAdminGet(request, `/admin/wallets/${userId}`, "获取钱包详情失败");
}
