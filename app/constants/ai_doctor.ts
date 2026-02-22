// --- 首页特性数据 (新增) ---
import { FileText, HeartPulse, ShieldCheck, BookOpen } from "lucide-react";

export interface HomeFeature {
  id: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  bgColor: string;
  title: string;
  shortDesc: string;
  detailTitle: string;
  detailContent: string;
}

export const features: HomeFeature[] = [
  {
    id: "privacy",
    icon: ShieldCheck,
    iconColor: "text-green-500",
    bgColor: "bg-green-50",
    title: "隐私保护",
    shortDesc: "数据安全",
    detailTitle: "全链路隐私安全保障",
    detailContent:
      "我们深知医疗数据的敏感性。您的化验单图片仅在内存中进行即时分析，分析完成后立即释放，绝不会保存到服务器或用于训练 AI 模型。全程采用 HTTPS 加密传输，请您放心使用。",
  },
  {
    id: "recognition",
    icon: FileText,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-50",
    title: "智能识别",
    shortDesc: "精准提取",
    detailTitle: "Gemini 多模态精准识别",
    detailContent:
      "依托 Google Gemini 先进的视觉大模型能力，系统能够精准提取化验单上复杂的生化指标、参考范围及异常箭头。即使照片存在轻微折痕、阴影或手写体，也能保持较高的识别准确率。",
  },
  {
    id: "advice",
    icon: HeartPulse,
    iconColor: "text-red-500",
    bgColor: "bg-red-50",
    title: "健康建议",
    shortDesc: "生活指导",
    detailTitle: "个性化健康管理方案",
    detailContent:
      "解读不仅仅是罗列数据。AI 会综合分析您的异常指标，为您提供针对性的饮食禁忌（如少吃油腻、海鲜等）、营养补充建议及生活作息调整方案，做您身边的 24 小时健康管家。",
  },
  {
    id: "guide",
    icon: BookOpen,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-50",
    title: "使用指南",
    shortDesc: "新手必读",
    detailTitle: "如何获取最佳解读效果？",
    detailContent:
      "1. 拍摄：请在光线充足处垂直拍摄，确保文字清晰、无反光。\n2. 上传：点击“选择照片”上传图片。\n3. 设置：根据需求选择“通俗”或“专业”解读风格。\n4. 查看：等待几秒即可查看包含健康评分、异常解读及改善建议的完整报告。",
  },
];
