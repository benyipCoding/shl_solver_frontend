import AuthGuard from "@/components/cms/layout/AuthGuard";
import Sidebar from "@/components/cms/layout/Sidebar";
import TopHeader from "@/components/cms/layout/TopHeader";

export default function CMSLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
