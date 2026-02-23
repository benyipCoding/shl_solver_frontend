"use client";

import { Model } from "@/interfaces/shl_solver";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";

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

/**
 * 压缩图片
 * @param file 原始图片文件
 * @returns 压缩后的图片文件
 */
export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 1, // 最大文件大小 (MB)
    maxWidthOrHeight: 1920, // 最大宽度或高度
    useWebWorker: true,
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    // 如果返回的是 Blob，我们需要将其转换为 File 对象，以保持通过 File 接口访问属性的一致性
    const compressedFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });

    console.log(
      `图片压缩成功: ${(file.size / 1024 / 1024).toFixed(2)} MB -> ${(
        compressedFile.size /
        1024 /
        1024
      ).toFixed(2)} MB`
    );
    return compressedFile;
  } catch (error) {
    console.error("图片压缩失败:", error);
    return file; // 如果压缩失败，返回原始文件
  }
};

/**
 * 将 File 对象转换为 Base64 字符串
 * @param file 图片文件
 * @returns Base64 字符串 Promise
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
