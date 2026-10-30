import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import HomeV1 from "@/components/home/HomeV1";
import HomeV2 from "@/components/home/HomeV2";

export default async function HomepagePreview({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  if (version !== "1" && version !== "2") notFound();
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-white dark:bg-slate-950">
      <div className="sticky top-0 z-[70] flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-4 py-2 text-xs text-slate-200">
        <span className="flex items-center gap-2">
          <Eye size={14} />第 {version} 版预览
          <span className="hidden text-slate-400 sm:inline">
            · 仅预览，未更改线上版本
          </span>
        </span>
        <Link
          href="/cms/homepage"
          className="flex items-center gap-1.5 text-sky-300 hover:text-sky-200"
        >
          <ArrowLeft size={13} />
          返回版本管理
        </Link>
      </div>
      {version === "2" ? <HomeV2 /> : <HomeV1 />}
    </div>
  );
}
