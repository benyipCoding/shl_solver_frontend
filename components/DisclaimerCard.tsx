import React from "react";
import { AlertTriangle } from "lucide-react";

export default function DisclaimerCard() {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-sm text-orange-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 shrink-0 text-orange-600 mt-0.5" />
        <div className="space-y-2">
          <h4 className="font-bold text-lg text-orange-800">免责声明</h4>

          <div className="space-y-2 opacity-90 text-sm">
            <p className="leading-relaxed">
              <strong>1. 非医疗诊断工具：</strong> 本结果基于 AI 技术生成，
              <strong>绝非医疗诊断建议</strong>。AI
              可能会产生识别错误或幻觉，切勿仅凭此报告调整用药或治疗方案。
            </p>
            <p className="leading-relaxed">
              <strong>2. 结果仅供参考：</strong>{" "}
              分析内容仅用于辅助理解化验单术语，所有指标解读请以医院出具的正式纸质报告及专业持证医生的诊断为准。
            </p>
            <p className="leading-relaxed">
              <strong>3. 隐私与数据：</strong>{" "}
              图片上传仅用于当次即时分析，系统不会在服务器上永久存储您的个人医疗数据。建议您在上传前自行遮挡姓名、身份证号等敏感隐私信息。
            </p>
            <p className="leading-relaxed font-bold text-orange-800 pt-1">
              ⚠️
              若您感觉身体不适或症状加重，请立即前往正规医院就诊或拨打急救电话。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
