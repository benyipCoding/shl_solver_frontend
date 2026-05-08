"use client";

import UserHeaderActions from "@/components/common/UserHeaderActions";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Sidebar from "./Sidebar"; // imported for mobile drawer optionally, or just header

export default function TopHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center">
        <button
          className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/"
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回前台
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <UserHeaderActions simpleMode={true} />
      </div>

      {mounted &&
        mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-64 bg-white dark:bg-slate-900 shadow-2xl">
              <div
                className="flex-1 overflow-y-auto"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Sidebar className="flex" />
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
