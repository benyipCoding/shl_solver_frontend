// Delayed with CSS so fast requests never paint a loading state or move content.
export default function LoadingNotice({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="cms-loading-notice pointer-events-none fixed right-4 top-20 z-50 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      {children}
    </div>
  );
}
