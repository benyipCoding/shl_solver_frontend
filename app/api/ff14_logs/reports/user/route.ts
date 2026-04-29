import {
  buildProxyPath,
  getTrimmedParam,
  proxyFf14Get,
} from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userName = getTrimmedParam(searchParams, "userName");

  if (!userName) {
    return Response.json({ error: "缺少 userName 参数" }, { status: 400 });
  }

  const path = buildProxyPath(
    `/ff14_logs/reports/user/${encodeURIComponent(userName)}`,
    searchParams,
    ["userName"]
  );

  return proxyFf14Get(path, "获取 FF14 User Reports 失败");
}
