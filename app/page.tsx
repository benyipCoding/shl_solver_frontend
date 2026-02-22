import React from "react";
import Link from "next/link";
import { Sparkles, Zap, ArrowRight, Bot, Layers, Cpu } from "lucide-react";
import UserHeaderActions from "@/components/UserHeaderActions";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-2 bg-indigo-600 rounded-lg group-hover:bg-indigo-700 transition-colors">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900">
                AI <span className="text-indigo-600">Hub</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <UserHeaderActions simpleMode={true} />
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero 区域 */}
        <section className="relative overflow-hidden pt-20 pb-20 lg:pt-32 lg:pb-32">
          {/* 背景装饰 */}
          <div className="absolute top-0 left-1/2 -ml-[50%] w-[200%] h-[200%] opacity-20 bg-[radial-gradient(closest-side,rgba(79,70,229,0.15)_0%,rgba(255,255,255,0)_100%)] pointer-events-none -z-10"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium mb-8 border border-indigo-100 shadow-sm animate-fade-in-up">
              <Sparkles className="h-4 w-4" />
              <span>不仅是解题，更是你的智能助手</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
              探索{" "}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-600">
                AI
              </span>{" "}
              的无限可能
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 mb-10 leading-relaxed font-light">
              这里汇集了多种强大的 AI 工具。从 SHL
              逻辑推理辅助到未来的更多智能服务，我们致力于为您提供更高效的解决方案。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/shl_solver"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-200 overflow-hidden"
              >
                <span className="relative z-10">立即体验 SHL 解题</span>
                <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 h-full w-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
              >
                了解更多功能
              </a>
            </div>
          </div>
        </section>

        {/* 功能展示网格 */}
        <section
          id="features"
          className="py-24 bg-linear-to-b from-white to-gray-50 border-t border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                核心功能库
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                我们正在持续构建更多 AI 驱动的工具，目前已上线以下功能
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Card 1: SHL 解题 (已上线) */}
              <Link
                href="/shl_solver"
                className="group relative bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* 装饰背景图标 */}
                <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 rotate-12">
                  <Cpu className="w-48 h-48 text-indigo-600" />
                </div>

                <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <Cpu className="h-7 w-7 text-indigo-600 group-hover:text-white transition-colors" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">
                  SHL 逻辑解题
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6 font-medium">
                  专为逻辑测试设计的 AI
                  助手。支持多种题型分析，提供解题思路，助您轻松应对测评挑战。
                </p>

                <div className="flex items-center text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                  <span>立即使用</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Card 2: 占位符 - 简历优化 */}
              <div className="relative bg-white p-8 rounded-2xl border border-dashed border-gray-300 flex flex-col hover:bg-gray-50 transition-colors">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-6">
                  <Layers className="h-7 w-7 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-3">
                  简历智能优化
                </h3>
                <p className="text-gray-500 leading-relaxed mb-6">
                  上传简历，AI
                  为您分析关键词匹配度，提供修改建议，让您的简历在筛选中脱颖而出。
                </p>
                <div className="mt-auto">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                    开发中
                  </span>
                </div>
              </div>

              {/* Card 3: 占位符 - 面试模拟 */}
              <div className="relative bg-white p-8 rounded-2xl border border-dashed border-gray-300 flex flex-col hover:bg-gray-50 transition-colors">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="h-7 w-7 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-3">
                  AI 面试模拟
                </h3>
                <p className="text-gray-500 leading-relaxed mb-6">
                  针对不同岗位的模拟面试训练，实时语音交互，为您提供回答反馈和改进建议。
                </p>
                <div className="mt-auto">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                    规划中
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 底部 Footer */}
        <footer className="bg-white border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Bot className="h-6 w-6 text-indigo-600" />
              </div>
              <span className="font-bold text-gray-900 tracking-tight">
                AI Hub
              </span>
            </div>

            <div className="flex items-center gap-8 text-sm font-medium text-gray-500">
              <a href="#" className="hover:text-indigo-600 transition-colors">
                隐私政策
              </a>
              <a href="#" className="hover:text-indigo-600 transition-colors">
                服务条款
              </a>
              <a href="#" className="hover:text-indigo-600 transition-colors">
                联系我们
              </a>
            </div>

            <div className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} AI Hub. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
