"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScanSearch,
  Trash2,
  ImageIcon,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  ImageData,
  TaskStatusResponse,
  TaskSubmitResponse,
  VerificationResult,
} from "@/interfaces/shl_solver";
import { compressImage } from "@/utils/helpers";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addVerificationImages,
  removeVerificationImage,
  setVerificationLoading,
  setVerificationResult,
  setVerificationError,
  resetVerification,
} from "@/store/features/shlSlice";

const VERIFY_TASK_STORAGE_KEY = "shl_verify_task_id";
const VERIFY_POLL_DELAY = 3000;

const parseApiResponse = async <T,>(response: Response): Promise<T> => {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok ? "服务返回了无法识别的数据" : "服务暂时不可用，请稍后重试"
    );
  }
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

interface VisualDiffProps {
  referenceCode: string;
}

const VisualDiff: React.FC<VisualDiffProps> = ({ referenceCode }) => {
  const dispatch = useAppDispatch();
  const {
    images: verificationImages,
    imagesData: verificationImagesData,
    loading: verificationLoading,
    result: verificationResult,
    error: verificationError,
  } = useAppSelector((state) => state.shl.verification);

  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [verificationTaskId, setVerificationTaskId] = useState<string | null>(
    null
  );

  const verificationFileInputRef = useRef<HTMLInputElement>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const clearVerificationTask = useCallback(() => {
    sessionStorage.removeItem(VERIFY_TASK_STORAGE_KEY);
    setVerificationTaskId(null);
  }, []);

  const handleResetVerification = () => {
    if (loadingToastIdRef.current) {
      toast.dismiss(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }

    clearVerificationTask();
    dispatch(resetVerification());

    if (verificationFileInputRef.current)
      verificationFileInputRef.current.value = "";
  };

  useEffect(() => {
    const savedTaskId = sessionStorage.getItem(VERIFY_TASK_STORAGE_KEY);

    if (savedTaskId) {
      setVerificationTaskId(savedTaskId);
      dispatch(setVerificationLoading(true));
    }
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!verificationTaskId) {
      return;
    }

    let isCancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const finishVerificationTask = () => {
      clearVerificationTask();
      dispatch(setVerificationLoading(false));
    };

    const settleToast = (message: string, isError: boolean) => {
      if (loadingToastIdRef.current) {
        const toastId = loadingToastIdRef.current;
        loadingToastIdRef.current = null;

        if (isError) {
          toast.error(message, { id: toastId });
        } else {
          toast.success(message, { id: toastId });
        }

        return;
      }

      if (isError) {
        toast.error(message);
      } else {
        toast.success(message);
      }
    };

    const pollVerificationTask = async () => {
      try {
        const response = await fetch(
          `/api/shl_analyze/task/${verificationTaskId}`,
          {
            cache: "no-store",
          }
        );
        const data = await parseApiResponse<
          TaskStatusResponse<VerificationResult> | { error?: string }
        >(response);

        if (!response.ok) {
          const message =
            ("error" in data && data.error) || "查询比对任务状态失败";

          if (!isCancelled) {
            dispatch(setVerificationError(message));
            finishVerificationTask();
            settleToast(message, true);
          }

          return;
        }

        const taskData = data as TaskStatusResponse<VerificationResult>;
        const status = taskData.status?.toLowerCase();

        if (status === "completed") {
          const result = taskData.result ?? null;

          if (!isCancelled) {
            dispatch(setVerificationResult(result));
            finishVerificationTask();
            settleToast(
              result?.has_errors
                ? "发现代码差异，请检查报告"
                : "代码比对完成，未发现明显错误",
              Boolean(result?.has_errors)
            );
          }

          return;
        }

        if (status === "failed") {
          const message = taskData.error || "比对失败，请重试";

          if (!isCancelled) {
            dispatch(setVerificationError(message));
            finishVerificationTask();
            settleToast(message, true);
          }

          return;
        }

        if (!isCancelled) {
          timerId = setTimeout(pollVerificationTask, VERIFY_POLL_DELAY);
        }
      } catch (error: unknown) {
        console.error("Verification polling failed:", error);

        if (!isCancelled) {
          const message = getErrorMessage(error, "查询比对任务状态失败");
          dispatch(setVerificationError(message));
          finishVerificationTask();
          settleToast(message, true);
        }
      }
    };

    timerId = setTimeout(pollVerificationTask, VERIFY_POLL_DELAY);

    return () => {
      isCancelled = true;

      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [clearVerificationTask, dispatch, verificationTaskId]);

  const handleVerificationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const validFiles = files.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length > 0) {
        setIsCompressing(true);
        try {
          const previews: string[] = [];
          const data: ImageData[] = [];

          for (const file of validFiles) {
            const compressedFile = await compressImage(file);
            const base64Str = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                if (
                  event.target?.result &&
                  typeof event.target.result === "string"
                ) {
                  resolve(event.target.result);
                } else {
                  reject(new Error("读取失败"));
                }
              };
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(compressedFile);
            });

            previews.push(base64Str);
            data.push({
              mimeType: compressedFile.type,
              data: base64Str.split(",")[1],
            });
          }

          dispatch(
            addVerificationImages({
              previews,
              data,
            })
          );
          dispatch(setVerificationResult(null));
          dispatch(setVerificationError(null));
        } catch (error) {
          console.error("Compression error:", error);
          toast.error("图片处理失败");
        } finally {
          setIsCompressing(false);
          // Reset input value so same files can be selected again if needed
          if (verificationFileInputRef.current) {
            verificationFileInputRef.current.value = "";
          }
        }
      } else {
        toast.error("请上传图片文件");
      }
    }
  };

  const verifyTypedCode = async () => {
    if (
      !verificationImagesData ||
      verificationImagesData.length === 0 ||
      !referenceCode ||
      verificationLoading ||
      verificationTaskId
    )
      return;

    dispatch(setVerificationLoading(true));
    dispatch(setVerificationError(null));
    dispatch(setVerificationResult(null));

    const toastId = toast.loading("正在上传并进行视觉比对分析...");

    try {
      const payload = {
        images_data: verificationImagesData,
        reference_code: referenceCode,
        language: "python", // 默认 Python，也可以根据需要动态传入
      };

      const response = await fetch("/api/shl_analyze/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse<
        TaskSubmitResponse | { error?: string }
      >(response);

      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "比对服务请求失败");
      }

      if (!("task_id" in data) || !data.task_id) {
        throw new Error("比对任务提交成功，但未返回任务编号");
      }

      sessionStorage.setItem(VERIFY_TASK_STORAGE_KEY, data.task_id);
      setVerificationTaskId(data.task_id);
      loadingToastIdRef.current = toastId;
    } catch (error: unknown) {
      const message = getErrorMessage(error, "比对失败，请重试");

      console.error("Verification failed:", error);
      dispatch(setVerificationError(message));
      dispatch(setVerificationLoading(false));
      clearVerificationTask();
      toast.error(message, { id: toastId });
    }
  };

  return (
    <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-orange-400 dark:bg-slate-900 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-slate-800 flex items-center text-sm md:text-base dark:text-slate-100">
          <ScanSearch className="w-5 h-5 mr-2 text-orange-500" /> 拍照找茬纠错
          (Beta)
        </h4>
        {verificationImages.length > 0 && !verificationLoading && (
          <button
            onClick={handleResetVerification}
            className="text-xs text-slate-400 hover:text-red-500 flex items-center font-medium"
          >
            <Trash2 className="w-3 h-3 mr-1" /> 清空照片
          </button>
        )}
      </div>

      <p className="text-sm text-slate-500 mb-4 leading-relaxed dark:text-slate-400">
        抄写遇到报错？拍摄包含您
        <span className="font-bold text-slate-700 dark:text-slate-200">
          考试电脑屏幕上所敲代码
        </span>
        的照片上传，AI
        将帮您快速找出拼写或缩进错误。支持上传多张照片以覆盖长代码。
        <span className="mt-1.5 text-amber-600 dark:text-amber-500 font-medium flex items-center">
          ⚠️
          注意：多张图片将按显示顺序进行拼接分析，请务必保证图片顺序与代码从上至下的逻辑一致。
        </span>
      </p>

      {/* Hidden Input for Verification */}
      <input
        type="file"
        ref={verificationFileInputRef}
        onChange={handleVerificationFileChange}
        className="hidden"
        accept="image/*"
        multiple
      />

      {/* Upload/Preview Area */}
      {verificationImages.length === 0 ? (
        <div
          onClick={() => verificationFileInputRef.current?.click()}
          className="relative overflow-hidden border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-orange-300 hover:bg-orange-50 transition-all cursor-pointer bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          {isCompressing && (
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-10 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                正在优化图片...
              </p>
            </div>
          )}
          <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            上传抄写截图/拍照
          </span>
          <span className="text-xs text-slate-400 mt-1">支持 JPG, PNG</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {verificationImages.map((img, idx) => (
              <div
                key={idx}
                className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 animate-fadeIn dark:bg-slate-800 dark:border-slate-700 aspect-video"
              >
                <Image
                  src={img}
                  alt={`Verification snapshot ${idx + 1}`}
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-cover"
                />
                <button
                  onClick={() => dispatch(removeVerificationImage(idx))}
                  className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-500/80 text-white p-1 rounded-full backdrop-blur-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add more button */}
            <div
              onClick={() => verificationFileInputRef.current?.click()}
              className="relative rounded-lg overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-500 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 cursor-pointer transition-all dark:bg-slate-800/50 dark:border-slate-700 aspect-video"
            >
              <ImageIcon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">添加照片</span>
            </div>
          </div>

          <button
            onClick={verifyTypedCode}
            disabled={verificationLoading || !!verificationResult}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center transition-all ${
              verificationLoading || !!verificationResult
                ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white shadow"
            }`}
          >
            {verificationLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在比对代码...
              </>
            ) : (
              <>
                <ScanSearch className="w-4 h-4 mr-2" />
                开始视觉比对纠错
              </>
            )}
          </button>
        </div>
      )}

      {/* Verification Loading/Results/Error */}
      <div className="relative min-h-1.25 mt-4">
        {/* {verificationLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-orange-500 animate-fadeIn bg-white/90 z-10 rounded dark:bg-slate-900/90">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs font-medium">
              AI 正在努力识别并寻找差异...
            </span>
          </div>
        )} */}

        {verificationError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start border border-red-100 text-xs animate-fadeIn z-10 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 mr-2.5 mt-0.5 shrink-0" />
            <p>{verificationError}</p>
          </div>
        )}

        {verificationResult && (
          <div className="space-y-4 animate-fadeIn">
            {/* Summary Alert */}
            <div
              className={`p-3 rounded-lg border text-xs flex items-start ${
                verificationResult.has_errors
                  ? "bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                  : "bg-green-50 text-green-900 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
              }`}
            >
              {verificationResult.has_errors ? (
                <AlertTriangle className="w-4 h-4 mr-2.5 mt-0.5 text-amber-600 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2.5 mt-0.5 text-green-600 shrink-0" />
              )}
              <div>
                <p className="font-semibold mb-1">比对完成</p>
                <p className="text-xs leading-relaxed">
                  {verificationResult.summary}
                </p>
              </div>
            </div>

            {/* Error List */}
            {verificationResult.has_errors &&
              verificationResult.errors &&
              verificationResult.errors.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-700 ml-1 dark:text-slate-300">
                    详细错误报告：
                  </h5>
                  {verificationResult.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono relative border-l-2 border-l-red-400 dark:bg-slate-800 dark:border-slate-700"
                    >
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-sans font-medium uppercase tracking-wider dark:bg-red-900/40 dark:text-red-300">
                        {err.type === "indentation"
                          ? "缩进错误"
                          : err.type === "typo"
                            ? "拼写错误"
                            : "标点/语法"}
                      </div>
                      <p className="text-slate-500 mb-2 font-sans dark:text-slate-400">
                        对应参考代码第{" "}
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {err.reference_line}
                        </span>{" "}
                        行
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 mb-2 text-[11px]">
                        <div className="bg-green-50 p-2 rounded border border-green-100 break-all dark:bg-green-900/20 dark:border-green-800">
                          <span className="text-green-700 font-sans font-bold dark:text-green-400">
                            [应为]
                          </span>
                          <br />
                          <span className="text-green-900 dark:text-green-100">
                            {err.expected_segment || "[空]"}
                          </span>
                        </div>
                        <div className="bg-red-50 p-2 rounded border border-red-100 break-all dark:bg-red-900/20 dark:border-red-800">
                          <span className="text-red-700 font-sans font-bold dark:text-red-400">
                            [实际识别为]
                          </span>
                          <br />
                          <span className="text-red-900 dark:text-red-100">
                            {err.found_segment || "[空]"}
                          </span>
                        </div>
                      </div>
                      <p className="text-amber-800 font-sans bg-amber-50 p-2 rounded border border-amber-100 italic dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
                        👉 修改建议：{err.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualDiff;
