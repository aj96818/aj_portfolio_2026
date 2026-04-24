export type DateRange = {
  symbol: string;
  min_date: string;
  max_date: string;
};

export type BacktestRequest = {
  symbol: string;
  benchmark_symbol: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  window: number;
  std_dev: number;
  trade_capital_percentage: number;
};

export type PricePoint = {
  date: string;
  price: number;
};

export type BollingerPoint = {
  date: string;
  moving_average: number | null;
  upper_band: number | null;
  lower_band: number | null;
};

export type Trade = {
  date: string;
  action: "BUY" | "SELL";
  price: number;
  shares: number;
  trade_value: number;
  percent_change: number | null;
  cumulative_return_dollars: number;
  cumulative_return_percentage: number;
  cash_after: number;
  position_value_after: number;
  total_equity_after: number;
};

export type EquityPoint = {
  date: string;
  portfolio_value: number;
  cash: number;
  shares: number;
  price: number;
};

export type BacktestParameters = {
  initial_capital: number;
  window: number;
  std_dev: number;
  trade_capital_percentage: number;
};

export type SummaryMetrics = {
  starting_capital: number;
  ending_value: number;
  total_return_percentage: number;
  total_return_dollars: number;
  number_of_trades: number;
  benchmark_ending_value: number;
  benchmark_return_percentage: number;
  benchmark_return_dollars: number;
  strategy_vs_benchmark_dollar_difference: number;
  strategy_vs_benchmark_percentage_point_difference: number;
};

export type BacktestResponse = {
  symbol: string;
  benchmark_symbol: string;
  start_date: string;
  end_date: string;
  parameters: BacktestParameters;
  price_series: PricePoint[];
  bollinger_bands: BollingerPoint[];
  trades: Trade[];
  bollinger_equity_curve: EquityPoint[];
  spy_equity_curve: EquityPoint[];
  summary: SummaryMetrics;
};
