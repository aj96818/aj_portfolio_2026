import { publicAssetPath } from "../config/appConfig";
import type { StockDataClient, WeeklyPrice } from "./stockDataClient";

const DEMO_DATA_ROOT = "data/demo";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(publicAssetPath(path), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to load demo data from ${path} (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

export class StaticStockDataClient implements StockDataClient {
  async getSymbols(): Promise<string[]> {
    const symbols = await fetchJson<string[]>(`${DEMO_DATA_ROOT}/symbols.json`);
    return symbols.map(normalizeSymbol).filter(Boolean);
  }

  async getWeeklyPrices(symbol: string): Promise<WeeklyPrice[]> {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) return [];

    const prices = await fetchJson<WeeklyPrice[]>(
      `${DEMO_DATA_ROOT}/weekly_prices/${encodeURIComponent(normalizedSymbol)}.json`
    );

    return prices
      .map((price) => ({ ...price, symbol: normalizeSymbol(price.symbol || normalizedSymbol) }))
      .sort((left, right) => left.week_date.localeCompare(right.week_date));
  }
}

export const staticStockDataClient = new StaticStockDataClient();
