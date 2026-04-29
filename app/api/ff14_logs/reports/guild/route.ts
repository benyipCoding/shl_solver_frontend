import {
  buildProxyPath,
  getTrimmedParam,
  proxyFf14Get,
} from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildName = getTrimmedParam(searchParams, "guildName");
  const serverName = getTrimmedParam(searchParams, "serverName");
  const serverRegion = getTrimmedParam(searchParams, "serverRegion");

  if (!guildName || !serverName || !serverRegion) {
    return Response.json(
      { error: "缺少 guildName、serverName 或 serverRegion 参数" },
      { status: 400 }
    );
  }

  const path = buildProxyPath(
    `/ff14_logs/reports/guild/${encodeURIComponent(guildName)}/${encodeURIComponent(serverName)}/${encodeURIComponent(serverRegion)}`,
    searchParams,
    ["guildName", "serverName", "serverRegion"]
  );

  return proxyFf14Get(path, "获取 FF14 Guild Reports 失败");
}
