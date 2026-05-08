import { NextRequest } from "next/server";
import { proxyAdminPost } from "@/app/api/admin/_utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  return proxyAdminPost(
    request,
    `/admin/wallets/${userId}/recharge`,
    "钱包充值失败"
  );
}
