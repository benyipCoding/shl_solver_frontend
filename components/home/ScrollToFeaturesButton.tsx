"use client";

import React from "react";
import { ArrowDown } from "lucide-react";

export default function ScrollToFeaturesButton() {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // Prevent default anchor jump
    const featuresSection = document.getElementById("features");
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href="#features"
      onClick={handleScroll}
      className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-200 overflow-hidden hover:-translate-y-0.5 cursor-pointer"
    >
      <span className="relative z-10">立即体验</span>
      <ArrowDown className="h-5 w-5 relative z-10 transition-transform" />
      <div className="absolute inset-0 h-full w-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
    </a>
  );
}
