import {
  buildProxyPath,
  getTrimmedParam,
  proxyFf14Get,
} from "@/app/api/ff14_logs/_utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = getTrimmedParam(searchParams, "view");
  const code = getTrimmedParam(searchParams, "code");

  if (!view || !code) {
    return Response.json({ error: "缺少 view 或 code 参数" }, { status: 400 });
  }

  const path = buildProxyPath(
    `/ff14_logs/report/tables/${encodeURIComponent(view)}/${encodeURIComponent(code)}`,
    searchParams,
    ["view", "code"]
  );

  return proxyFf14Get(path, "获取 FF14 汇总表数据失败");
}
