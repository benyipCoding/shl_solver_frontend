import { NextRequest } from "next/server";
import { proxyAdminGet, proxyAdminPatch } from "@/app/api/admin/_utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyAdminGet(request, `/admin/users/${userId}`, "获取用户详情失败");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyAdminPatch(request, `/admin/users/${userId}`, "更新用户失败");
}
