import { NextRequest } from "next/server";
import { proxyAdminGet } from "@/app/api/admin/_utils";

export async function GET(request: NextRequest) {
  return proxyAdminGet(request, "/admin/users", "获取用户列表失败");
}
