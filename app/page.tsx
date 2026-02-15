"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Code,
  BookOpen,
  Cpu,
  Check,
  AlertCircle,
  Terminal,
  Copy,
  Loader2,
  Image as ImageIcon,
  X,
  Plus,
  Trash2,
  ChevronDown,
  Lightbulb,
  Maximize2,
  ArrowLeft,
  ArrowRight,
  Eye,
  Sparkles,
  LogIn,
  Mail,
  Lock,
  RefreshCw,
  ArrowLeftCircle,
  User,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { FormData, ValidationErrors } from "@/interfaces/auth";
import {
  AnalysisResult,
  Complexity,
  ImageData,
  Model,
} from "@/interfaces/home";

const Home = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<string>("home"); // 'home' or 'login'
  const [authMode, setAuthMode] = useState<string>("login"); // 'login', 'register', 'forgot'

  // Form State
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    captcha: "",
    username: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  // Model Definitions
  const MODELS: Model[] = [
    {
      id: "gemini-2.5-flash-preview-09-2025",
      name: "Gemini 2.5 Flash (速度快)",
    },
    {
      id: "gemini-2.0-flash-thinking-exp-01-21",
      name: "Gemini 2.0 Thinking (强推理)",
    },
    { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro (综合强)" },
  ];

  // Changed from single null state to empty arrays for multiple images
  const [images, setImages] = useState<string[]>([]); // Array of preview URLs
  const [imagesData, setImagesData] = useState<ImageData[]>([]); // Array of { mimeType, data } objects
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("solution"); // 'solution' or 'analysis'
  const [selectedLanguage, setSelectedLanguage] = useState<string>("python"); // 'python', 'java', 'javascript'
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id); // Default to Flash

  // Transcription Mode State
  const [isTranscriptionMode, setIsTranscriptionMode] =
    useState<boolean>(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Configuration
  const apiKey = ""; // Environment handles the key

  // --- Form Validation Logic ---
  const validateField = (name: string, value: string | undefined): string => {
    let errorMsg = "";
    const val = value || "";

    // Common checks
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
        if (val.length < 8) {
          errorMsg = "密码长度至少需要8位";
        }
        break;
      case "confirmPassword":
        if (val !== formData.password) {
          errorMsg = "两次输入的密码不一致";
        }
        break;
      case "captcha":
        // Basic check handled by non-empty above, add length check if strict
        if (val.length !== 4) {
          errorMsg = "验证码为4位字符";
        }
        break;
      default:
        break;
    }
    return errorMsg;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time validation
    const error = validateField(name, value);
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields on submit
    const newErrors: ValidationErrors = {};
    let hasError = false;

    // Determine fields to check based on authMode
    const fieldsToCheck = [];
    if (authMode === "login")
      fieldsToCheck.push("email", "password", "captcha");
    if (authMode === "register")
      fieldsToCheck.push("username", "email", "password", "confirmPassword");
    if (authMode === "forgot") fieldsToCheck.push("email");

    fieldsToCheck.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    });

    setErrors(newErrors);

    if (!hasError) {
      if (authMode === "forgot") {
        alert("重置链接已发送到您的邮箱（模拟）");
        setAuthMode("login");
      } else {
        setCurrentView("home");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      captcha: "",
      username: "",
      confirmPassword: "",
    });
    setErrors({});
  };

  // Reset form when switching modes
  useEffect(() => {
    resetForm();
  }, [authMode, currentView]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    // Only handle paste in home view
    if (currentView !== "home") return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) filesToProcess.push(blob);
      }
    }
    if (filesToProcess.length > 0) {
      processFiles(filesToProcess);
    }
  };

  // New function to handle multiple files asynchronously
  const processFiles = async (filesRaw: FileList | File[]) => {
    if (!filesRaw || filesRaw.length === 0) return;

    const files = Array.from(filesRaw);
    const validFiles = files.filter((file) => file.type.startsWith("image/"));

    if (validFiles.length === 0 && files.length > 0) {
      setError("请上传有效的图片文件 (JPG, PNG)");
      return;
    }

    if (validFiles.length < files.length) {
      setError("部分非图片文件已被自动过滤。");
    } else {
      setError(null);
    }

    const readPromises = validFiles.map((file) => {
      return new Promise<{ preview: string; data: string; mimeType: string }>(
        (resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result && typeof reader.result === "string") {
              resolve({
                preview: reader.result,
                data: reader.result.split(",")[1],
                mimeType: file.type,
              });
            } else {
              reject(new Error("File reading failed"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }
      );
    });

    try {
      const results = await Promise.all(readPromises);

      // Append new images to existing arrays
      setImages((prev) => [...prev, ...results.map((r) => r.preview)]);
      setImagesData((prev) => [
        ...prev,
        ...results.map((r) => ({ mimeType: r.mimeType, data: r.data })),
      ]);

      setResult(null);
      // Clear input so the same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setError("读取文件时出错，请重试。");
      console.error("File reading error:", e);
    }
  };

  const clearAllImages = () => {
    setImages([]);
    setImagesData([]);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagesData((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const analyzeProblem = async () => {
    if (imagesData.length === 0) return;

    setLoading(true);
    setError(null);

    // Dynamic API URL based on selected model
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are an expert algorithmist and software engineer specializing in SHL/HackerRank/Automata Pro style coding assessments. 
    Your task is to analyze one or more images that sequentially describe a business scenario programming problem. Read the images in order to understand the complete context.
    
    CRITICAL: Input/Output Format Instructions for SHL Assessments:
    The user is taking an SHL Automata Pro test. The code MUST use the specific input reading methods preferred by this platform:
    
    1. **Python 3**: 
       - ALWAYS use \`input()\` to read stdin. 
       - DO NOT use \`sys.stdin.readline()\`. 
       - Example: \`name = input()\` instead of \`name = sys.stdin.readline()\`.
    
    2. **Java**: 
       - Use \`java.util.Scanner(System.in)\` for standard input reading unless the problem explicitly requires \`BufferedReader\` for performance.
       - Structure: \`public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); ... } }\`
    
    3. **JavaScript (Node.js)**:
       - If the problem implies a simplified environment, use \`readline()\`.
       - Otherwise, use the standard Node.js \`process.stdin\` boilerplate to handle input streams.
       - DO NOT simply write a function (e.g., \`function solution(A, B)\`) unless the prompt explicitly asks for a function signature. Assume a full script is needed.

    Please structure your response in a JSON format with the following keys:
    1. "summary": A concise summary of the business logic in Chinese.
    2. "key_concepts": A list of specific programming concepts (e.g., Dynamic Programming, HashMap, Sliding Window) and potential pitfalls/difficulties tested by this problem (in Chinese).
    3. "constraints": A list of technical constraints, input formats, and output requirements (in Chinese).
    4. "solutions": A dictionary object containing complete, executable solutions in 3 languages. The keys must be exact: "python", "java", and "javascript".
       - Ensure the code follows the Input/Output instructions above strictly.
       - The code must be highly optimized, handle edge cases, and include comments explaining the logic.
    5. "complexity": Time and Space complexity analysis (in Chinese). Can be a string or an object with "time" and "space" keys.
    
    IMPORTANT: Ensure the JSON is valid and strictly follows the structure. Do not wrap the JSON in markdown code blocks like \`\`\`json. Just return the raw JSON string.`;

    const userPrompt =
      "Analyze these images containing a coding problem description. Provide solutions in Python, Java, and JavaScript based on the complete context.";

    // Prepare payload with multiple images using stored mimeType
    const imageParts = imagesData.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || "image/jpeg",
        data: img.data,
      },
    }));

    const payload = {
      contents: [
        {
          parts: [{ text: userPrompt }, ...imageParts],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    try {
      // Retry logic with exponential backoff
      const maxRetries = 5;
      let responseData = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (
              response.status >= 400 &&
              response.status < 500 &&
              response.status !== 429
            ) {
              throw new Error(
                `API Error (${response.status}): ${errorText || response.statusText}`
              );
            }
            throw new Error(
              `Server Error (${response.status}): ${errorText || response.statusText}`
            );
          }

          responseData = await response.json();
          break; // Success, exit loop
        } catch (err) {
          if (i === maxRetries - 1) throw err;
          const delay = Math.pow(2, i) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (
        responseData &&
        responseData.candidates &&
        responseData.candidates[0] &&
        responseData.candidates[0].content
      ) {
        const responseText = responseData.candidates[0].content.parts[0].text;
        try {
          const parsedResult = JSON.parse(responseText);
          setResult(parsedResult);
        } catch (e) {
          console.error("JSON Parse Error:", e);
          const cleanedText = responseText
            .replace(/```json/g, "")
            .replace(/```/g, "");
          setResult(JSON.parse(cleanedText));
        }
      } else {
        throw new Error("API returned no content.");
      }
    } catch (err: any) {
      console.error(err);
      setError(`分析失败: ${err.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  };

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [currentView]); // Re-bind when view changes

  const getCodeContent = () => {
    if (!result) return "";
    if (result.solutions && result.solutions[selectedLanguage]) {
      return result.solutions[selectedLanguage];
    }
    return result.code || "";
  };

  // --- Transcription Mode Logic ---
  const enterTranscriptionMode = () => {
    setCurrentLineIndex(0);
    setIsTranscriptionMode(true);
  };

  const exitTranscriptionMode = () => {
    setIsTranscriptionMode(false);
  };

  const nextLine = () => {
    const lines = getCodeContent().split("\n");
    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex((prev) => prev + 1);
    }
  };

  const prevLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex((prev) => prev - 1);
    }
  };

  // Helper to render visible spaces for indentation
  const renderLineWithVisibleSpaces = (line: string) => {
    if (!line) return <span className="text-slate-400 italic">[空行]</span>;

    // Count leading spaces
    const leadingSpacesMatch = line.match(/^(\s*)/);
    const leadingSpacesCount = leadingSpacesMatch
      ? leadingSpacesMatch[0].length
      : 0;
    const content = line.substring(leadingSpacesCount);

    return (
      <div className="flex items-center flex-wrap break-all">
        {/* Render visible dots for leading spaces */}
        <div className="flex select-none">
          {Array.from({ length: leadingSpacesCount }).map((_, i) => (
            <span key={i} className="text-slate-300 font-mono text-xl mx-px">
              •
            </span>
          ))}
        </div>
        <span>{content}</span>
      </div>
    );
  };

  // Helper to safely render complexity (handles both string and object)
  const renderComplexity = (complexity: string | Complexity | undefined) => {
    if (!complexity) return null;
    if (typeof complexity === "string") {
      return (
        <p className="text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
          {complexity}
        </p>
      );
    }
    if (typeof complexity === "object") {
      return (
        <div className="text-slate-600 text-xs md:text-sm leading-relaxed space-y-1">
          {complexity.time && (
            <div>
              <span className="font-semibold text-slate-700">时间复杂度:</span>{" "}
              {complexity.time}
            </div>
          )}
          {complexity.space && (
            <div>
              <span className="font-semibold text-slate-700">空间复杂度:</span>{" "}
              {complexity.space}
            </div>
          )}
          {/* Fallback if keys are different */}
          {!complexity.time && !complexity.space && JSON.stringify(complexity)}
        </div>
      );
    }
    return null;
  };

  interface ValidatedInputProps {
    type: string;
    name: string;
    placeholder: string;
    icon?: React.ElementType;
    required?: boolean;
    maxLength?: number;
  }

  // Helper component for input with validation
  const ValidatedInput: React.FC<ValidatedInputProps> = ({
    type,
    name,
    placeholder,
    icon: Icon,
    required = false,
    maxLength,
  }) => (
    <div className="space-y-1 relative">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
        {name === "email" && "Email"}
        {name === "password" && "密码"}
        {name === "confirmPassword" && "确认密码"}
        {name === "username" && "用户名"}
        {name === "captcha" && "验证码"}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-slate-400" />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={formData[name]}
          onChange={handleInputChange}
          className={`block w-full ${Icon ? "pl-10" : "px-3"} pr-3 py-2 md:py-2.5 bg-slate-50 border ${errors[name] ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm ${name === "captcha" ? "text-center tracking-widest uppercase" : ""}`}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
        />
        {/* Error Message: Absolute positioned to avoid layout shift */}
        {errors[name] && (
          <div className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium animate-fadeIn flex items-center bg-white/80 px-1 rounded z-10">
            <AlertCircle className="w-2.5 h-2.5 mr-1" /> {errors[name]}
          </div>
        )}
      </div>
    </div>
  );

  // --- Auth View Components ---
  if (currentView === "login") {
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
          
          /* Custom scrollbar for inner container just in case content is too tall */
          .scrollbar-hide::-webkit-scrollbar {
              display: none;
          }
          .scrollbar-hide {
              -ms-overflow-style: none;  /* IE and Edge */
              scrollbar-width: none;  /* Firefox */
          }
        `}</style>

        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-64 bg-linear-to-b from-blue-50 to-transparent pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        {/* Main Card: max-height restricted to viewport, internal scroll if needed */}
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8 relative z-10 animate-fadeIn flex flex-col max-h-[95dvh] overflow-y-auto scrollbar-hide">
          {/* Header Section based on authMode */}
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
              {authMode === "register" && "注册以保存您的解题历史"}
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
              {/* Email */}
              <ValidatedInput
                type="email"
                name="email"
                placeholder="your@email.com"
                icon={Mail}
                required
              />

              {/* Password */}
              <div className="space-y-1 relative">
                <div className="flex justify-between items-center">
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
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`block w-full pl-10 pr-3 py-2 md:py-2.5 bg-slate-50 border ${errors.password ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm`}
                    placeholder="••••••••"
                    required
                  />
                  {/* Error Message */}
                  {errors.password && (
                    <div className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium animate-fadeIn flex items-center bg-white/80 px-1 rounded z-10">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" />{" "}
                      {errors.password}
                    </div>
                  )}
                </div>
              </div>

              {/* Captcha */}
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
                      placeholder="ABCD"
                      maxLength={4}
                      required
                    />
                    {/* Error Message */}
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
                  >
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
                    <span className="font-mono text-lg font-bold text-slate-500 italic tracking-widest decoration-wavy line-through decoration-slate-300">
                      8k2A
                    </span>
                    <div className="absolute right-1 top-1 p-0.5 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <RefreshCw className="w-3 h-3 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center mt-4"
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
              {/* Name */}
              <ValidatedInput
                type="text"
                name="username"
                placeholder="John Doe"
                icon={User}
                required
              />

              {/* Email */}
              <ValidatedInput
                type="email"
                name="email"
                placeholder="your@email.com"
                icon={Mail}
                required
              />

              {/* Password */}
              <ValidatedInput
                type="password"
                name="password"
                placeholder="设置密码"
                icon={Lock}
                required
              />

              {/* Confirm Password */}
              <ValidatedInput
                type="password"
                name="confirmPassword"
                placeholder="重复密码"
                icon={CheckCircle2}
                required
              />

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] flex items-center justify-center mt-3 md:mt-4"
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

              {/* Email */}
              <ValidatedInput
                type="email"
                name="email"
                placeholder="your@email.com"
                icon={Mail}
                required
              />

              {/* Submit */}
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

          {/* Footer Actions */}
          <div className="mt-4 md:mt-6 text-center border-t border-slate-100 pt-4 md:pt-6 shrink-0">
            <button
              onClick={() => {
                setCurrentView("home");
                setAuthMode("login");
              }}
              className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors flex items-center justify-center mx-auto"
            >
              <ArrowLeftCircle className="w-4 h-4 mr-1.5" /> 返回主页 (游客模式)
            </button>
          </div>
        </div>

        {/* Footer Info (Hidden on small screens to save space) */}
        <div className="absolute bottom-4 text-xs text-slate-400 hidden md:block">
          © 2024 SHL Solver. All rights reserved.
        </div>
      </div>
    );
  }

  // --- Main Home View ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 pb-10 relative flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

        body, .font-sans {
          font-family: 'Noto Sans SC', sans-serif !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .dashed-border {
          background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-dasharray='6%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }
        /* Safe area padding for mobile notches */
        .safe-top {
          padding-top: env(safe-area-inset-top);
        }
      `}</style>

      {/* --- Transcription Overlay --- */}
      {isTranscriptionMode && (
        <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col safe-top animate-fadeIn">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
            <div className="flex flex-col">
              <span className="text-sm text-slate-400 font-medium uppercase tracking-wider">
                专注抄写模式
              </span>
              <span className="text-xs text-slate-500 mt-0.5">
                点 ( • ) 代表空格，请严格保持缩进
              </span>
            </div>
            <button
              onClick={exitTranscriptionMode}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col justify-center px-4 overflow-hidden relative">
            {/* Context: Previous Line (Faint) */}
            <div className="opacity-30 text-sm md:text-base font-mono mb-6 ml-2 select-none pointer-events-none truncate">
              {currentLineIndex > 0
                ? getCodeContent().split("\n")[currentLineIndex - 1]
                : ""}
            </div>

            {/* Active Line (Giant) */}
            <div className="bg-slate-800 p-6 rounded-2xl border-l-4 border-blue-500 shadow-2xl font-mono text-xl md:text-3xl leading-relaxed tracking-wide min-h-30 flex items-center">
              {renderLineWithVisibleSpaces(
                getCodeContent().split("\n")[currentLineIndex]
              )}
            </div>

            {/* Context: Next Line (Faint) */}
            <div className="opacity-30 text-sm md:text-base font-mono mt-6 ml-2 select-none pointer-events-none truncate">
              {currentLineIndex < getCodeContent().split("\n").length - 1
                ? getCodeContent().split("\n")[currentLineIndex + 1]
                : ""}
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 bg-slate-800 border-t border-slate-700 pb-10">
            <div className="flex justify-between items-center mb-4 text-slate-400 text-sm font-mono">
              <span>
                Line {currentLineIndex + 1} /{" "}
                {getCodeContent().split("\n").length}
              </span>
              <span className="text-xs uppercase">{selectedLanguage}</span>
            </div>

            <div className="flex space-x-4 h-16">
              <button
                onClick={prevLine}
                disabled={currentLineIndex === 0}
                className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextLine}
                disabled={
                  currentLineIndex === getCodeContent().split("\n").length - 1
                }
                className="flex-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-30 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-900/50 transition-all active:scale-95"
              >
                下一行 <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          {/* Logo Title */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
                <Cpu className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
                  SHL Scenario Solver
                </h1>
                <p className="text-[10px] md:text-xs text-slate-500 hidden sm:block">
                  业务场景算法题辅助工具
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Model Selector & Features */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3 w-full md:w-auto">
            {/* Model Selector */}
            <div className="relative w-full md:w-auto flex-1 md:flex-none">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full md:w-60 appearance-none pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition-colors cursor-pointer"
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Login & Multi-image indicator */}
            <div className="flex items-center w-full md:w-auto justify-between md:justify-end space-x-2">
              <div className="hidden md:flex items-center space-x-2 text-sm text-slate-600 border-l border-slate-200 pl-3">
                <span className="flex items-center text-xs text-slate-500">
                  <ImageIcon className="w-3 h-3 mr-1" /> 多图支持
                </span>
              </div>

              <button
                onClick={() => {
                  setCurrentView("login");
                  setAuthMode("login");
                }}
                className="flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs md:text-sm font-medium rounded-lg transition-colors ml-2 w-full md:w-auto"
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5" /> 登 录
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8 w-full flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full flex-1">
          {/* Left Column: Upload & Preview */}
          <div className="space-y-4 md:space-y-6 h-full flex flex-col">
            {/* Hidden Input for Multiple Files */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              multiple // Enabled multiple selection
            />

            {/* Initial Upload State */}
            {images.length === 0 ? (
              <div
                className="border-2 border-dashed border-slate-300 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer bg-white shadow-sm touch-manipulation flex-1"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-blue-100 p-4 rounded-full mb-4">
                  <Upload className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-slate-700 mb-2">
                  上传题目图片
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-xs leading-relaxed">
                  点击上传，或直接{" "}
                  <span className="font-bold text-slate-700">Ctrl+V</span> 粘贴
                </p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors text-sm md:text-base w-full md:w-auto">
                  选择多张图片
                </button>
              </div>
            ) : (
              // Multiple Images Preview State
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative animate-fadeIn flex-1 flex flex-col">
                <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-semibold text-slate-700 flex items-center text-sm md:text-base">
                    <ImageIcon className="w-4 h-4 mr-2" /> 已上传{" "}
                    {images.length} 张图片
                  </h3>
                  <button
                    onClick={clearAllImages}
                    className="text-slate-400 hover:text-red-500 transition-colors flex items-center text-xs md:text-sm font-medium p-2"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> 清空
                  </button>
                </div>

                {/* Image List */}
                <div className="p-3 md:p-4 bg-slate-100 flex flex-col space-y-3 md:space-y-4 max-h-[40vh] md:max-h-[50vh] overflow-y-auto flex-1">
                  {images.map((imgSrc, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg shadow-sm overflow-hidden border border-slate-200 bg-white h-full"
                    >
                      <img
                        src={imgSrc}
                        alt={`Problem part ${index + 1}`}
                        className="w-full object-contain max-h-48 md:max-h-64 lg:max-h-full"
                      />
                      <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => removeImage(index)}
                          className="bg-white/90 text-slate-500 hover:text-red-500 p-2 rounded-full shadow-sm hover:shadow-md transition-all backdrop-blur-sm"
                          title="移除此图片"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] md:text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                        Part {index + 1}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions Area */}
                <div className="p-3 md:p-4 bg-white border-t border-slate-100 space-y-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium transition-colors flex items-center justify-center border border-slate-200 dashed-border text-sm md:text-base"
                  >
                    <Plus className="w-4 h-4 mr-2" /> 继续添加 / 粘贴
                  </button>
                  <button
                    onClick={analyzeProblem}
                    disabled={loading}
                    className={`w-full py-3 rounded-xl font-bold text-base md:text-lg flex items-center justify-center shadow-md transition-all ${loading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg"}`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        正在使用{" "}
                        {MODELS.find((m) => m.id === selectedModel)?.name.split(
                          " "
                        )[2] || "AI"}{" "}
                        分析...
                      </>
                    ) : (
                      <>
                        <Cpu className="w-5 h-5 mr-2" />
                        开始组合分析
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start border border-red-100 animate-fadeIn text-sm md:text-base">
                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Instructions */}
            {!result && !loading && images.length === 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 md:p-5">
                <h4 className="font-semibold text-indigo-900 mb-3 flex items-center text-sm md:text-base">
                  <BookOpen className="w-4 h-4 mr-2" /> 使用技巧
                </h4>
                <ul className="space-y-2 text-xs md:text-sm text-indigo-800">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>{" "}
                    <span className="font-semibold">多页题目：</span>
                    题目太长可分段截图，依次上传。
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>{" "}
                    <span className="font-semibold">顺序重要：</span>AI
                    会按上传顺序理解上下文。
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>{" "}
                    <span className="font-semibold">移动端：</span>
                    支持直接拍照或从相册选择。
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="flex flex-col h-full">
            {result ? (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full animate-fadeIn">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                  <button
                    onClick={() => setActiveTab("solution")}
                    className={`flex-1 py-3 md:py-4 font-medium text-sm flex items-center justify-center transition-colors ${activeTab === "solution" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                  >
                    <Code className="w-4 h-4 mr-2" /> 代码方案
                  </button>
                  <button
                    onClick={() => setActiveTab("analysis")}
                    className={`flex-1 py-3 md:py-4 font-medium text-sm flex items-center justify-center transition-colors ${activeTab === "analysis" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                  >
                    <BookOpen className="w-4 h-4 mr-2" /> 场景与考点
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                  {activeTab === "solution" && (
                    <div className="space-y-4 md:space-y-6">
                      <div className="flex justify-between items-center mb-2">
                        {/* Language Selector */}
                        <div className="relative">
                          <select
                            value={selectedLanguage}
                            onChange={(e) =>
                              setSelectedLanguage(e.target.value)
                            }
                            className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:bg-slate-200 transition-colors"
                          >
                            <option value="python">Python 3</option>
                            <option value="java">Java</option>
                            <option value="javascript">JavaScript</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Transcription Mode Button */}
                          <button
                            onClick={enterTranscriptionMode}
                            className="text-xs flex items-center text-white bg-indigo-600 hover:bg-indigo-700 font-medium px-3 py-1.5 rounded-full transition-colors shadow-sm"
                            title="进入专注抄写模式"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">抄写模式</span>
                          </button>

                          <button
                            onClick={() => copyToClipboard(getCodeContent())}
                            className="text-xs flex items-center text-blue-600 hover:text-blue-700 font-medium bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-full transition-colors"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">复制</span>
                          </button>
                        </div>
                      </div>

                      {/* Code Preview */}
                      <div className="relative group">
                        <div className="absolute top-0 left-0 w-full h-full bg-slate-900 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none"></div>
                        <pre className="bg-slate-900 text-slate-100 p-4 md:p-5 rounded-xl overflow-x-auto text-xs md:text-sm font-mono leading-relaxed border border-slate-800 shadow-inner">
                          <code>{getCodeContent()}</code>
                        </pre>
                      </div>

                      <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-semibold text-slate-800 mb-3 flex items-center text-sm md:text-base">
                          <Cpu className="w-4 h-4 mr-2 text-indigo-600" />{" "}
                          复杂度分析
                        </h4>
                        {renderComplexity(result.complexity)}
                      </div>
                    </div>
                  )}

                  {activeTab === "analysis" && (
                    <div className="space-y-4 md:space-y-6">
                      {/* Scenario Summary */}
                      <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-semibold text-slate-800 mb-2 md:mb-3 text-base md:text-lg">
                          场景摘要
                        </h4>
                        <p className="text-slate-600 leading-relaxed text-sm">
                          {result.summary}
                        </p>
                      </div>

                      {/* NEW: Exam Points / Key Concepts Module */}
                      <div className="bg-violet-50 p-4 md:p-5 rounded-xl border border-violet-100 shadow-sm">
                        <h4 className="font-semibold text-violet-900 mb-2 md:mb-3 flex items-center text-sm md:text-base">
                          <Lightbulb className="w-4 h-4 mr-2 text-violet-600" />{" "}
                          题目考点 & 难点
                        </h4>
                        {result.key_concepts &&
                        Array.isArray(result.key_concepts) ? (
                          <div className="space-y-2">
                            {result.key_concepts.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start text-sm text-violet-800"
                              >
                                <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-violet-400 rounded-full shrink-0"></span>
                                <span className="leading-relaxed">{item}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-violet-800 leading-relaxed">
                            {result.key_concepts || "正在分析考点..."}
                          </p>
                        )}
                      </div>

                      {/* Constraints Module */}
                      <div className="bg-yellow-50 p-4 md:p-5 rounded-xl border border-yellow-100 shadow-sm">
                        <h4 className="font-semibold text-yellow-900 mb-2 md:mb-3 flex items-center text-sm md:text-base">
                          <Check className="w-4 h-4 mr-2" /> 关键约束 & 输入输出
                        </h4>
                        {Array.isArray(result.constraints) ? (
                          <ul className="space-y-2">
                            {result.constraints.map((item, idx) => (
                              <li
                                key={idx}
                                className="flex items-start text-sm text-yellow-800"
                              >
                                <span className="mr-2 mt-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0"></span>
                                <span className="leading-relaxed">{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                            {result.constraints}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 min-h-75">
                <Terminal className="w-12 h-12 md:w-16 md:h-16 mb-4 opacity-20" />
                <p className="text-base md:text-lg font-medium opacity-50">
                  等待题目解析...
                </p>
                <p className="text-xs md:text-sm opacity-40 mt-2 text-center">
                  上传左侧图片后，结果将显示在这里
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
