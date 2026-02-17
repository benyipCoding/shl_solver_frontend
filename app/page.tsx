"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Cpu,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  X,
  ChevronDown,
  Sparkles,
  LogIn,
  User,
  LogOut,
} from "lucide-react";
import { AnalysisResult, ImageData, Model } from "@/interfaces/home";
import ImageUploader from "@/components/ImageUploader";
import ResultDisplay from "@/components/ResultDisplay";
import { useAuth } from "@/context/AuthContext";

const Home = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Generate a consistent color from string
  const getAvatarColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-amber-500",
      "bg-green-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-sky-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-violet-500",
      "bg-purple-500",
      "bg-fuchsia-500",
      "bg-pink-500",
      "bg-rose-500",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

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

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id); // Default to Flash

  // API Configuration
  const apiKey = ""; // Environment handles the key

  const analyzeProblem = async (imagesData: ImageData[]) => {
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

              {!user && (
                <button
                  onClick={() => router.push("/auth")}
                  className="flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs md:text-sm font-medium rounded-lg transition-colors ml-2 w-full md:w-auto"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5" /> 登 录
                </button>
              )}
              {user && (
                <div
                  className="relative ml-2 w-full md:w-auto flex justify-end"
                  ref={profileRef}
                >
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-white hover:shadow-md transition-all ${getAvatarColor(
                      user.username || user.email || "User"
                    )}`}
                    title={user.username || user.email}
                  >
                    {(user.username || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-fadeIn origin-top-right">
                      <div className="px-4 py-3 border-b border-slate-50">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user.username || "用户"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user.email}
                        </p>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            logout();
                            setIsProfileOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          退出登录
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8 w-full flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 w-full flex-1">
          {/* Left Column: Image Uploader */}
          <ImageUploader
            onAnalyze={analyzeProblem}
            onClearResult={() => setResult(null)}
            loading={loading}
            selectedModelName={
              MODELS.find((m) => m.id === selectedModel)?.name.split(" ")[2] ||
              "AI"
            }
          />

          {/* Right Column: Result Display */}
          <ResultDisplay result={result} />
        </div>

        {/* Global API Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 text-red-700 p-4 rounded-xl flex items-start border border-red-100 animate-fadeIn text-sm md:text-base">
            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
