import {
  buildProxyPath,
  getTrimmedParam,
  proxyFf14Get,
} from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const characterName = getTrimmedParam(searchParams, "characterName");
  const serverName = getTrimmedParam(searchParams, "serverName");
  const serverRegion = getTrimmedParam(searchParams, "serverRegion");

  if (!characterName || !serverName || !serverRegion) {
    return Response.json(
      { error: "缺少 characterName、serverName 或 serverRegion 参数" },
      { status: 400 }
    );
  }

  const path = buildProxyPath(
    `/ff14_logs/rankings/character/${encodeURIComponent(characterName)}/${encodeURIComponent(serverName)}/${encodeURIComponent(serverRegion)}`,
    searchParams,
    ["characterName", "serverName", "serverRegion"]
  );

  return proxyFf14Get(path, "获取 FF14 Character Rankings 失败");
}
