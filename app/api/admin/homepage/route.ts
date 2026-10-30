import { NextRequest } from "next/server";
import { proxyAdminGet, proxyAdminPatch } from "@/app/api/admin/_utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const response = await proxyAdminGet(
    request,
    "/admin/homepage",
    "获取首页版本失败",
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function PATCH(request: NextRequest) {
  return proxyAdminPatch(request, "/admin/homepage", "发布首页版本失败");
}
