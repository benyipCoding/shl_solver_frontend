import {
  buildProxyPath,
  getTrimmedParam,
  proxyFf14Get,
} from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encounterID = getTrimmedParam(searchParams, "encounterID");

  if (!encounterID) {
    return Response.json({ error: "缺少 encounterID 参数" }, { status: 400 });
  }

  const path = buildProxyPath(
    `/ff14_logs/rankings/encounter/${encodeURIComponent(encounterID)}`,
    searchParams,
    ["encounterID"]
  );

  return proxyFf14Get(path, "获取 FF14 Encounter Rankings 失败");
}
