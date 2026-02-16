"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn,
  Mail,
  Lock,
  RefreshCw,
  ArrowLeftCircle,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { FormData, ValidationErrors } from "@/interfaces/auth";
import ValidatedInput from "@/components/ValidatedInput";

const AuthPage = () => {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">(
    "login"
  ); // 'login', 'register', 'forgot'

  // Form State
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    captcha: "",
    confirmPassword: "",
  });

  const [captchaImage, setCaptchaImage] = useState<string>("");
  const [captchaId, setCaptchaId] = useState<string>("");

  const [errors, setErrors] = useState<ValidationErrors>({});

  // --- Fetch Captcha ---
  const fetchCaptcha = async () => {
    try {
      const res = await fetch(`/api/captcha?captchaId=${captchaId}`, {
        method: "GET",
      });
      const data = await res.json();
      if (data.image && data.captchaId) {
        setCaptchaImage(data.image);
        setCaptchaId(data.captchaId);
      }
    } catch (error) {
      console.error("Failed to fetch captcha", error);
    }
  };

  useEffect(() => {
    if (authMode === "login") {
      fetchCaptcha();
    }
  }, [authMode]);

  // --- Form Validation Logic ---
  const validateField = (name: string, value: string | undefined): string => {
    let errorMsg = "";
    const val = value || "";

    if (!val || val.trim() === "") {
      return "此项不能为空";
    }

    switch (name) {
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          errorMsg = "请输入有效的邮箱地址";
        }
        break;
      case "password":
        if (val.length < 6) {
          errorMsg = "密码长度至少需要6位";
        }
        break;
      case "confirmPassword":
        if (val !== formData.password) {
          errorMsg = "两次输入的密码不一致";
        }
        break;
      // case "captcha":
      //   if (val.length !== 4) {
      //     errorMsg = "验证码为4位字符";
      //   }
      //   break;
      default:
        break;
    }
    return errorMsg;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateCaptcha = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/captcha", {
        method: "POST",
        body: JSON.stringify({
          captchaId,
          userInput: formData.captcha,
        }),
      });
      const data = await res.json();
      return data.success;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const handleLoginSubmit = async () => {
    const isCaptchaValid = await validateCaptcha();
    if (!isCaptchaValid) {
      setErrors((prev) => ({ ...prev, captcha: "验证码错误" }));
      fetchCaptcha();
      return;
    }
    console.log("继续下面的流程");
  };

  const handleAuthSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors: ValidationErrors = {};
    let hasError = false;

    const fieldsToCheck = [];
    if (authMode === "login")
      fieldsToCheck.push("email", "password", "captcha");
    if (authMode === "register")
      fieldsToCheck.push("email", "password", "confirmPassword");
    if (authMode === "forgot") fieldsToCheck.push("email");

    fieldsToCheck.forEach((field) => {
      const error = validateField(field, formData[field as keyof FormData]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    });
    setErrors(newErrors);
    if (hasError) return;
    if (authMode === "login") handleLoginSubmit();
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      captcha: "",
      confirmPassword: "",
    });
    setErrors({});
  };

  useEffect(() => {
    resetForm();
  }, [authMode]);

  return (
    <div className="h-dvh w-full bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-blue-100 relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

        body, .font-sans {
          font-family: 'Noto Sans SC', sans-serif !important;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-linear-to-b from-blue-50 to-transparent pointer-events-none"></div>
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8 relative z-10 animate-fadeIn flex flex-col max-h-[95dvh] overflow-y-auto scrollbar-hide">
        <div className="text-center mb-6 shrink-0">
          <div className="bg-blue-600 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg shadow-blue-200">
            {authMode === "login" && (
              <LogIn className="w-5 h-5 md:w-6 md:h-6 text-white" />
            )}
            {authMode === "register" && (
              <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
            )}
            {authMode === "forgot" && (
              <KeyRound className="w-5 h-5 md:w-6 md:h-6 text-white" />
            )}
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-slate-800">
            {authMode === "login" && "欢迎回来"}
            {authMode === "register" && "创建账号"}
            {authMode === "forgot" && "重置密码"}
          </h2>
          <p className="text-slate-500 text-xs md:text-sm mt-1.5">
            {authMode === "login" && "登录 SHL 场景解题助手"}
            {authMode === "register" && "注册以解锁更多功能"}
            {authMode === "forgot" && "输入邮箱以获取重置链接"}
          </p>
        </div>

        {/* LOGIN FORM */}
        {authMode === "login" && (
          <form
            className="space-y-4 md:space-y-6 shrink-0"
            onSubmit={handleAuthSubmit}
            noValidate
          >
            <ValidatedInput
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              error={errors.email}
              placeholder="your@email.com"
              icon={Mail}
              required
            />
            <div className="space-y-1 relative">
              {/* <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
                  密码
                </label>
                <button
                  type="button"
                  onClick={() => setAuthMode("forgot")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  忘记密码?
                </button>
              </div> */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <ValidatedInput
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  error={errors.password}
                  placeholder="••••••••"
                  required
                />
                {errors.password && (
                  <div className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium animate-fadeIn flex items-center bg-white/80 px-1 rounded z-10">
                    <AlertCircle className="w-2.5 h-2.5 mr-1" />{" "}
                    {errors.password}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
                验证码
              </label>
              <div className="flex space-x-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    name="captcha"
                    value={formData.captcha}
                    onChange={handleInputChange}
                    className={`block w-full px-3 py-2 md:py-2.5 bg-slate-50 border ${errors.captcha ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-center tracking-widest uppercase`}
                    placeholder="请输入验证码"
                    // maxLength={4}
                    required
                  />
                  {errors.captcha && (
                    <div className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium animate-fadeIn flex items-center bg-white/80 px-1 rounded z-10">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" />{" "}
                      {errors.captcha}
                    </div>
                  )}
                </div>
                <div
                  className="w-24 md:w-28 h-9.5 md:h-10.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center relative overflow-hidden select-none cursor-pointer group hover:border-slate-300 transition-colors"
                  title="点击刷新"
                  onClick={fetchCaptcha}
                >
                  {captchaImage ? (
                    <img
                      src={captchaImage}
                      alt="验证码"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                    </div>
                  )}
                  <div className="absolute right-1 top-1 p-0.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <RefreshCw className="w-3 h-3 text-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center mt-3 md:mt-8"
            >
              登 录
            </button>

            <div className="text-center pt-1 md:pt-2">
              <p className="text-sm text-slate-500">
                还没有账号？{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className="text-blue-600 font-bold hover:text-blue-700 transition-colors"
                >
                  立即注册
                </button>
              </p>
            </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {authMode === "register" && (
          <form
            className="space-y-4 shrink-0"
            onSubmit={handleAuthSubmit}
            noValidate
          >
            {/* username field removed per request */}
            <ValidatedInput
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              error={errors.email}
              placeholder="your@email.com"
              icon={Mail}
              required
            />
            <ValidatedInput
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              error={errors.password}
              placeholder="设置密码"
              icon={Lock}
              required
            />
            <ValidatedInput
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              error={errors.confirmPassword}
              placeholder="重复密码"
              icon={CheckCircle2}
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center mt-3 md:mt-8"
            >
              注 册
            </button>
            <div className="text-center pt-1 md:pt-2">
              <p className="text-sm text-slate-500">
                已有账号？{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="text-blue-600 font-bold hover:text-blue-700 transition-colors"
                >
                  直接登录
                </button>
              </p>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {authMode === "forgot" && (
          <form
            className="space-y-4 md:space-y-6 shrink-0"
            onSubmit={handleAuthSubmit}
            noValidate
          >
            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 border border-blue-100 mb-2">
              请输入您注册时使用的电子邮箱地址，我们将向您发送一个重置密码的链接。
            </div>
            <ValidatedInput
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              error={errors.email}
              placeholder="your@email.com"
              icon={Mail}
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center mt-4"
            >
              发送重置邮件
            </button>
            <div className="text-center pt-1 md:pt-2">
              <p className="text-sm text-slate-500">
                想起密码了？{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="text-blue-600 font-bold hover:text-blue-700 transition-colors"
                >
                  返回登录
                </button>
              </p>
            </div>
          </form>
        )}

        <div className="mt-4 md:mt-6 text-center border-t border-slate-100 pt-4 md:pt-6 shrink-0">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors flex items-center justify-center mx-auto"
          >
            <ArrowLeftCircle className="w-4 h-4 mr-1.5" /> 返回主页 (游客模式)
          </button>
        </div>
      </div>

      {/* <div className="absolute bottom-4 text-xs text-slate-400 hidden md:block">
        © 2024 SHL Solver. All rights reserved.
      </div> */}
    </div>
  );
};

export default AuthPage;
