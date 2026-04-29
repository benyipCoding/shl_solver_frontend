import axios from "axios";
import { NextResponse } from "next/server";

import apiClient from "@/utils/request";

export const buildProxyQuery = (
  searchParams: URLSearchParams,
  excludedKeys: string[] = []
) => {
  const nextSearchParams = new URLSearchParams();

  searchParams.forEach((value, key) => {
    const trimmedValue = value.trim();

    if (excludedKeys.includes(key) || trimmedValue === "") {
      return;
    }

    nextSearchParams.append(key, trimmedValue);
  });

  return nextSearchParams.toString();
};

export const buildProxyPath = (
  basePath: string,
  searchParams: URLSearchParams,
  excludedKeys: string[] = []
) => {
  const query = buildProxyQuery(searchParams, excludedKeys);
  return `${basePath}${query ? `?${query}` : ""}`;
};

export const getTrimmedParam = (searchParams: URLSearchParams, key: string) =>
  searchParams.get(key)?.trim() ?? "";

const getProxyError = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as
      | { message?: string; error?: string }
      | undefined;

    return {
      message: responseData?.message || responseData?.error || fallbackMessage,
      status: error.response?.status || error.status || 500,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      status: 500,
    };
  }

  return {
    message: fallbackMessage,
    status: 500,
  };
};

export const proxyFf14Get = async (path: string, fallbackMessage: string) => {
  try {
    const response = await apiClient.get(path);
    return NextResponse.json(response.data);
  } catch (error) {
    const proxyError = getProxyError(error, fallbackMessage);

    return NextResponse.json(
      { error: proxyError.message },
      { status: proxyError.status }
    );
  }
};
