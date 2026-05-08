import { NextRequest, NextResponse } from "next/server";
import apiClient from "@/utils/request";

const getErrorStatus = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response
  ) {
    return Number(error.response.status) || 500;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return 500;
};

const getErrorPayload = (error: unknown, fallbackMessage: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    return error.response.data;
  }

  if (typeof error === "object" && error !== null) {
    if ("error" in error || "message" in error || "detail" in error) {
      return error;
    }
  }

  return { error: fallbackMessage };
};

const readSearchParams = (request: NextRequest) => {
  const params: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    if (value !== "") {
      params[key] = value;
    }
  });

  return params;
};

const createErrorResponse = (error: unknown, fallbackMessage: string) => {
  return NextResponse.json(getErrorPayload(error, fallbackMessage), {
    status: getErrorStatus(error),
  });
};

export const proxyAdminGet = async (
  request: NextRequest,
  path: string,
  fallbackMessage: string
) => {
  try {
    const res = await apiClient.get(path, {
      params: readSearchParams(request),
    });

    return NextResponse.json(res.data, { status: res.status });
  } catch (error) {
    return createErrorResponse(error, fallbackMessage);
  }
};

export const proxyAdminPost = async (
  request: NextRequest,
  path: string,
  fallbackMessage: string
) => {
  try {
    const body = await request.json();
    const res = await apiClient.post(path, body);

    return NextResponse.json(res.data, { status: res.status });
  } catch (error) {
    return createErrorResponse(error, fallbackMessage);
  }
};

export const proxyAdminPatch = async (
  request: NextRequest,
  path: string,
  fallbackMessage: string
) => {
  try {
    const body = await request.json();
    const res = await apiClient.patch(path, body);

    return NextResponse.json(res.data, { status: res.status });
  } catch (error) {
    return createErrorResponse(error, fallbackMessage);
  }
};
