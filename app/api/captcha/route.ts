import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

// 获取验证码接口
export async function GET() {
  try {
    // 请求后端验证码接口，注意设置 responseType 为 arraybuffer 以正确接收图片二进制数据
    const res = await apiClient.get("/captcha/", {
      responseType: "arraybuffer",
    });

    // 获取图片二进制数据
    const imageBuffer = Buffer.from(res.data, "binary");
    // 将图片转换为 base64 字符串
    const base64Image = `data:image/png;base64,${imageBuffer.toString(
      "base64"
    )}`;

    // 从响应头中获取 Captcha-Id
    // 注意：axios 获取的 headers key 可能是小写的
    const captchaId = res.headers["captcha-id"] || res.headers["Captcha-Id"];

    if (!captchaId) {
      throw new Error("Missing Captcha-Id in response headers");
    }

    // 返回 JSON 数据给前端，包含图片 base64 和 captchaId
    return NextResponse.json({
      image: base64Image,
      captchaId: captchaId,
    });
  } catch (error: any) {
    console.error("获取验证码失败:", error);
    return NextResponse.json(
      { error: "获取验证码失败" },
      { status: error.response?.status || 500 }
    );
  }
}
