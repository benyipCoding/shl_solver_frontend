import { NextRequest, NextResponse } from "next/server";

const apiBaseUrl =
  process.env.API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();

const missingApiBaseUrlMessage =
  "缺少后端基地址配置，请设置 API_BASE_URL 或 NEXT_PUBLIC_BASE_URL";

const buildForwardHeaders = (request: NextRequest) => {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor);
  }

  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    headers.set("user-agent", userAgent);
  }

  return headers;
};

const extractProxyErrorMessage = (payload: any, fallbackErrorMessage: string) => {
  if (!payload) return fallbackErrorMessage;
  if (typeof payload.message === "string" && payload.message) return payload.message;
  if (typeof payload.error === "string" && payload.error) return payload.error;
  if (typeof payload.detail === "string" && payload.detail) return payload.detail;
  if (Array.isArray(payload.detail) && payload.detail[0]?.msg) {
    return String(payload.detail[0].msg);
  }
  return fallbackErrorMessage;
};

export async function proxyMarketMasterGet(
  request: NextRequest,
  path: string,
  fallbackErrorMessage: string
) {
  return proxyMarketMasterRequest(
    request,
    path,
    fallbackErrorMessage,
    "GET"
  );
}

export async function proxyMarketMasterPost(
  request: NextRequest,
  path: string,
  fallbackErrorMessage: string
) {
  return proxyMarketMasterRequest(
    request,
    path,
    fallbackErrorMessage,
    "POST"
  );
}

async function proxyMarketMasterRequest(
  request: NextRequest,
  path: string,
  fallbackErrorMessage: string,
  method: "GET" | "POST"
) {
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: missingApiBaseUrlMessage },
      { status: 500 }
    );
  }

  const queryString = request.nextUrl.searchParams.toString();
  const url = `${apiBaseUrl.replace(/\/$/, "")}${path}${
    queryString ? `?${queryString}` : ""
  }`;

  try {
    const response = await fetch(url, {
      method,
      headers: buildForwardHeaders(request),
      cache: "no-store",
    });

    const bodyText = await response.text();
    let payload: any = null;

    try {
      payload = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      payload = { error: bodyText || fallbackErrorMessage };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: extractProxyErrorMessage(payload, fallbackErrorMessage),
          message: extractProxyErrorMessage(payload, fallbackErrorMessage),
        },
        { status: response.status }
      );
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || fallbackErrorMessage,
      },
      { status: 502 }
    );
  }
}
