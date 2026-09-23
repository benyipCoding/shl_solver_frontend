import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/context/AuthContext";
import { FetchProvider } from "@/context/FetchContext";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { PostHogProvider } from "@/components/common/PostHogProvider";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { ReduxProvider } from "@/store/ReduxProvider";

const geistSans = localFont({
  src: "../assets/fonts/geist/geist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../assets/fonts/geist-mono/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["monospace"],
});

export const metadata: Metadata = {
  title: "AI Hub - 你的智能助手集合",
  description: "集成SHL解题辅助、简历优化、面试模拟等多种AI功能的综合平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReduxProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PostHogProvider>
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
              <AuthProvider>
                <FetchProvider>
                  <Toaster position="top-center" />
                  {children}
                </FetchProvider>
              </AuthProvider>
            </PostHogProvider>
          </ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
