import { NextRequest } from "next/server";
import { proxyAdminGet } from "@/app/api/admin/_utils";

export async function GET(request: NextRequest) {
  return proxyAdminGet(request, "/admin/token-records", "获取 Token 记录失败");
}
