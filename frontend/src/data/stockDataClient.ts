export type WeeklyPrice = {
  symbol: string;
  week_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close?: number;
  volume?: number;
};

export interface StockDataClient {
  getSymbols(): Promise<string[]>;
  getWeeklyPrices(symbol: string): Promise<WeeklyPrice[]>;
}
