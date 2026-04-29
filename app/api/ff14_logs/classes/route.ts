import { buildProxyPath, proxyFf14Get } from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = buildProxyPath("/ff14_logs/classes", searchParams);

  return proxyFf14Get(path, "获取 FF14 职业数据失败");
}
