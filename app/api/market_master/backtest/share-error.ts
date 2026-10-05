import { NextResponse } from "next/server";

export function backtestShareError(error: unknown, fallback: string) {
  const failure = error as {
    status?: number; message?: string; error?: string; detail?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  const status = failure?.status || failure?.response?.status || 500;
  const message = failure?.message || failure?.error || failure?.detail || failure?.response?.data?.message || fallback;
  return NextResponse.json({ error: message, message, code: status }, { status });
}
