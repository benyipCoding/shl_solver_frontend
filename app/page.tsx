import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Bot,
  Cpu,
  Activity,
  FileSpreadsheet,
  Plus,
  ArrowDown,
} from "lucide-react";
import UserHeaderActions from "@/components/common/UserHeaderActions";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import ScrollToFeaturesButton from "@/components/home/ScrollToFeaturesButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-50 selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-b border-gray-100 dark:border-slate-800 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-2 bg-indigo-600 rounded-lg group-hover:bg-indigo-700 transition-all duration-300 shadow-md shadow-indigo-500/20">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-gray-100">
                AI{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  Hub
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <UserHeaderActions />
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero 区域 */}
        <section className="relative overflow-hidden pt-20 pb-20 lg:pt-32 lg:pb-32">
          {/* 背景装饰 */}
          <div className="absolute top-0 left-1/2 -ml-[50%] w-[200%] h-[200%] opacity-20 bg-[radial-gradient(closest-side,rgba(79,70,229,0.15)_0%,rgba(255,255,255,0)_100%)] pointer-events-none -z-10 animate-pulse-slow"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-8 border border-indigo-100 dark:border-indigo-800 shadow-sm animate-fade-in-up hover:scale-105 transition-transform cursor-default">
              <Sparkles className="h-4 w-4" />
              <span>不仅是工具，更是你的智能生活助手</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 mb-6 leading-tight">
              探索{" "}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                AI
              </span>{" "}
              的无限可能
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 leading-relaxed font-light">
              这里汇集了多种强大的 AI 工具。从 SHL
              逻辑推理辅助、智能验单助手，到高效的 Excel
              数据处理，我们致力于为您提供更高效的解决方案。
            </p>

            <div className="flex justify-center mt-8">
              <ScrollToFeaturesButton />
            </div>
          </div>
        </section>

        {/* 功能展示网格 */}
        <section
          id="features"
          className="py-24 bg-linear-to-b from-white to-gray-50 border-t border-gray-100 dark:from-slate-900 dark:to-slate-950 dark:border-slate-800"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
                核心功能库
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">
                我们正在持续构建更多 AI 驱动的工具，目前已上线以下功能
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Card 1: SHL 解题 (已上线) */}
              <Link
                href="/shl_solver"
                className="group relative bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* 装饰背景图标 */}
                <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] dark:opacity-[0.05] dark:group-hover:opacity-[0.1] transition-opacity duration-500 rotate-12">
                  <Cpu className="w-48 h-48 text-indigo-600 dark:text-indigo-400" />
                </div>

                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <Cpu className="h-7 w-7 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  SHL 逻辑解题
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6 font-medium grow">
                  专为逻辑测试设计的 AI
                  助手。支持多种题型分析，提供解题思路，助您轻松应对测评挑战。
                </p>

                <div className="mt-auto pt-4 flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  <span>立即使用</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Card 2: Excel Workbench (新增) */}
              <Link
                href="/excel_workbench"
                className="group relative bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* 装饰背景图标 */}
                <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] dark:opacity-[0.05] dark:group-hover:opacity-[0.1] transition-opacity duration-500 rotate-12">
                  <FileSpreadsheet className="w-48 h-48 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 dark:group-hover:bg-emerald-600 group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <FileSpreadsheet className="h-7 w-7 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Excel 数据助手
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6 font-medium grow">
                  上传表格，智能对话。通过 AI
                  快速进行数据筛选、分析与处理，让复杂的数据任务变得简单高效。
                </p>

                <div className="mt-auto pt-4 flex items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                  <span>立即使用</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Card 3: 智能验单助手 (已上线) */}
              <Link
                href="/ai_doctor"
                className="group relative bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* 装饰背景图标 */}
                <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] dark:opacity-[0.05] dark:group-hover:opacity-[0.1] transition-opacity duration-500 rotate-12">
                  <Activity className="w-48 h-48 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 dark:group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <Activity className="h-7 w-7 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  智能验单助手
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6 font-medium grow">
                  专业的 AI
                  医疗验单解读。上传化验单，快速获取简单易懂的健康报告分析。
                </p>

                <div className="mt-auto pt-4 flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                  <span>立即使用</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Card 4: 更多功能开发中 */}
              <div className="relative bg-gray-50 dark:bg-slate-800/50 p-8 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center text-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-75">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <Plus className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">
                  更多功能
                </h3>
                <p className="text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                  我们正在研发更多实用的 AI 工具，敬请期待...
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 底部 Footer */}
        <footer className="bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <Bot className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                AI Hub
              </span>
            </div>

            <div className="flex items-center gap-8 text-sm font-medium text-gray-500 dark:text-gray-400">
              <a
                href="#"
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                隐私政策
              </a>
              <a
                href="#"
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                服务条款
              </a>
              <a
                href="#"
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                联系我们
              </a>
            </div>

            <div className="text-sm text-gray-400 dark:text-gray-500">
              &copy; {new Date().getFullYear()} AI Hub. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
