"use client";

import { Model } from "@/interfaces/shl_solver";
import toast from "react-hot-toast";

export const fetchLLMs = async () => {
  try {
    const res = await fetch("/api/llms");
    const data = await res.json();
    if (!res.ok) {
      console.error("获取LLMs失败:", data.message || res.statusText);
      toast.error("获取LLMs失败: " + (data.message || res.statusText));
      return;
    }
    return data.filter((m: Model) => m.enabled);
  } catch (error) {
    console.error("获取LLMs失败:", error);
    toast.error("获取LLMs失败: " + (error || "未知错误"));
  }
};
