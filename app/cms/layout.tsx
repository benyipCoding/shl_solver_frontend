import AuthGuard from "@/components/cms/layout/AuthGuard";
import Sidebar from "@/components/cms/layout/Sidebar";
import TopHeader from "@/components/cms/layout/TopHeader";
import "./cms.css";

export default function CMSLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div
        data-cms-shell
        className="flex min-h-dvh bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100"
      >
        <a
          href="#cms-main"
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-3"
        >
          跳至内容
        </a>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopHeader />
          <main
            id="cms-main"
            className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-8"
          >
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
