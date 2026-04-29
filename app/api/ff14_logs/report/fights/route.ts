import {
  buildProxyPath,
  getTrimmedParam,
  proxyFf14Get,
} from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = getTrimmedParam(searchParams, "code");

  if (!code) {
    return Response.json({ error: "缺少 code 参数" }, { status: 400 });
  }

  const path = buildProxyPath(
    `/ff14_logs/report/fights/${encodeURIComponent(code)}`,
    searchParams,
    ["code"]
  );

  return proxyFf14Get(path, "获取 FF14 战斗数据失败");
}
