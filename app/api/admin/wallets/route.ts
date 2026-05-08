import { NextRequest } from "next/server";
import { proxyAdminGet } from "@/app/api/admin/_utils";

export async function GET(request: NextRequest) {
  return proxyAdminGet(request, "/admin/wallets", "获取钱包列表失败");
}
