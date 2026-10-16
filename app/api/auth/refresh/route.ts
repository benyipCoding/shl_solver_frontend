import { NextResponse } from "next/server";
import apiClient from "@/utils/request";

/** Renew the short-lived access cookie using the refresh cookie. */
export async function POST() {
  try {
    const backendResponse = await apiClient.post(
      "/auth/refresh",
      {},
      { validateStatus: (status) => status < 500 }
    );
    const response = NextResponse.json(backendResponse.data, {
      status: backendResponse.status,
    });
    const setCookieHeader = backendResponse.headers["set-cookie"];

    if (Array.isArray(setCookieHeader)) {
      setCookieHeader.forEach((cookie) =>
        response.headers.append("Set-Cookie", cookie)
      );
    } else if (typeof setCookieHeader === "string") {
      response.headers.set("Set-Cookie", setCookieHeader);
    }

    return response;
  } catch (error: unknown) {
    const typedError = error as {
      response?: { status?: number; data?: { detail?: string } };
      status?: number;
      message?: string;
    };
    const status = Number(
      typedError.response?.status || typedError.status || 500
    );
    return NextResponse.json(
      {
        error:
          typedError.response?.data?.detail || typedError.message || "登录已失效",
      },
      { status }
    );
  }
}
