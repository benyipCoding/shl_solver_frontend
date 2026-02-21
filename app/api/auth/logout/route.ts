import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import apiClient from "@/utils/request";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    let apiResponse;
    try {
      apiResponse = await apiClient.post(
        "/auth/logout",
        {},
        {
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          validateStatus: (status) => status < 500,
        }
      );
    } catch (error: any) {
      console.error("Logout request failed:", error.message);
      return NextResponse.json(
        { message: "Backend service unavailable" },
        { status: 503 }
      );
    }

    const { data: responseData, status, headers } = apiResponse;

    const response = NextResponse.json(responseData, { status });

    // 处理后端返回的 Set-Cookie 头以清除 Cookie
    const setCookieHeader = headers["set-cookie"];
    if (setCookieHeader) {
      if (Array.isArray(setCookieHeader)) {
        setCookieHeader.forEach((cookie) => {
          response.headers.append("Set-Cookie", cookie);
        });
      } else {
        response.headers.set("Set-Cookie", setCookieHeader as string);
      }
    }

    return response;
  } catch (error) {
    console.error("Logout route error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
