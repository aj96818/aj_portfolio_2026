import type { BacktestRequest, BacktestResponse, DateRange } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // Keep the generic HTTP error when the response is not JSON.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export async function fetchSymbols(): Promise<string[]> {
  const payload = await requestJson<{ symbols: string[] }>("/symbols");
  return payload.symbols;
}

export async function fetchDateRange(symbol: string): Promise<DateRange> {
  return requestJson<DateRange>(`/date-range/${encodeURIComponent(symbol)}`);
}

export async function runBacktest(payload: BacktestRequest): Promise<BacktestResponse> {
  return requestJson<BacktestResponse>("/backtest/bollinger-vs-spy", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
