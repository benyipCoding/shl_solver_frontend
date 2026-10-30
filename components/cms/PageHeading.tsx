import type { LucideIcon } from "lucide-react";

export default function PageHeading({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="min-w-0">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-widest text-teal-700 dark:text-teal-400">
          <Icon size={15} /> 工作空间 / 管理中心
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}
