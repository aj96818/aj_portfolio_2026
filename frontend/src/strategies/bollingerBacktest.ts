import type { StockDataClient, WeeklyPrice } from "../data/stockDataClient";
import type {
  BacktestRequest,
  BacktestResponse,
  BollingerPoint,
  DateRange,
  EquityPoint,
  PricePoint,
  SummaryMetrics,
  Trade
} from "../types";

type PriceRow = {
  date: string;
  price: number;
  moving_average: number | null;
  upper_band: number | null;
  lower_band: number | null;
};

type Lot = {
  shares: number;
  price: number;
};

type StrategyResult = {
  price_series: PricePoint[];
  bands: BollingerPoint[];
  trades: Trade[];
  equity_curve: EquityPoint[];
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const roundFloat = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const roundPercent = (value: number) => Math.round(value * 100) / 100;

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const adjustedPrice = (price: WeeklyPrice) => {
  if (isFiniteNumber(price.adjusted_close)) return price.adjusted_close;
  if (isFiniteNumber(price.close)) return price.close;
  return null;
};

function selectPriceRows(prices: WeeklyPrice[], startDate: string, endDate: string) {
  return prices
    .map((price) => ({
      date: price.week_date,
      price: adjustedPrice(price)
    }))
    .filter((price): price is { date: string; price: number } => {
      const inRange = price.date >= startDate && price.date <= endDate;
      return inRange && isFiniteNumber(price.price);
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function getDateRangeFromWeeklyPrices(symbol: string, prices: WeeklyPrice[]): DateRange | null {
  const dates = prices
    .filter((price) => isFiniteNumber(adjustedPrice(price)))
    .map((price) => price.week_date)
    .sort((left, right) => left.localeCompare(right));

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  if (!minDate || !maxDate) return null;

  return {
    symbol: symbol.trim().toUpperCase(),
    min_date: minDate,
    max_date: maxDate
  };
}

function addBollingerBands(rows: { date: string; price: number }[], window: number, stdDev: number): PriceRow[] {
  return rows.map((row, index) => {
    if (index < window - 1) {
      return {
        ...row,
        moving_average: null,
        upper_band: null,
        lower_band: null
      };
    }

    const windowRows = rows.slice(index - window + 1, index + 1);
    const mean = windowRows.reduce((sum, item) => sum + item.price, 0) / window;
    const variance =
      windowRows.reduce((sum, item) => sum + (item.price - mean) ** 2, 0) / Math.max(1, window - 1);
    const rollingStd = Math.sqrt(variance);

    return {
      ...row,
      moving_average: mean,
      upper_band: mean + stdDev * rollingStd,
      lower_band: mean - stdDev * rollingStd
    };
  });
}

function runBollingerBacktest(
  rows: { date: string; price: number }[],
  request: BacktestRequest
): StrategyResult {
  if (rows.length === 0) {
    throw new Error("No price rows were available for the selected symbol and date range.");
  }

  if (rows.length < request.window) {
    throw new Error(
      `Need at least ${request.window} adjusted weekly prices to compute Bollinger Bands; found ${rows.length}.`
    );
  }

  const frame = addBollingerBands(rows, request.window, request.std_dev);
  let cash = request.initial_capital;
  let shares = 0;
  const tradeNotional = (request.initial_capital * request.trade_capital_percentage) / 100;
  const lots: Lot[] = [];
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  if (tradeNotional <= 0) {
    throw new Error("Trade capital percentage must produce a positive trade amount.");
  }

  for (const row of frame) {
    const upperBand = row.upper_band;
    const lowerBand = row.lower_band;
    const hasBands = upperBand !== null && lowerBand !== null;

    if (hasBands && row.price <= lowerBand && cash > 0) {
      const tradeValue = Math.min(cash, tradeNotional);
      const boughtShares = tradeValue / row.price;
      shares += boughtShares;
      cash -= tradeValue;
      lots.push({ shares: boughtShares, price: row.price });

      const totalEquityAfter = shares * row.price + cash;
      const cumulativeReturnDollars = totalEquityAfter - request.initial_capital;
      trades.push({
        date: row.date,
        action: "BUY",
        price: roundMoney(row.price),
        shares: roundFloat(boughtShares),
        trade_value: roundMoney(tradeValue),
        percent_change: null,
        cumulative_return_dollars: roundMoney(cumulativeReturnDollars),
        cumulative_return_percentage: roundPercent((cumulativeReturnDollars / request.initial_capital) * 100),
        cash_after: roundMoney(cash),
        position_value_after: roundMoney(shares * row.price),
        total_equity_after: roundMoney(totalEquityAfter)
      });
    } else if (hasBands && row.price >= upperBand && shares > 0) {
      const targetSaleValue = Math.min(shares * row.price, tradeNotional);
      const sharesToSell = targetSaleValue / row.price;
      let remainingToSell = sharesToSell;
      let costBasis = 0;

      while (remainingToSell > 0 && lots.length > 0) {
        const lot = lots[0];
        const soldFromLot = Math.min(lot.shares, remainingToSell);
        costBasis += soldFromLot * lot.price;
        lot.shares -= soldFromLot;
        remainingToSell -= soldFromLot;
        if (lot.shares <= 1e-12) lots.shift();
      }

      const proceeds = sharesToSell * row.price;
      shares -= sharesToSell;
      if (shares <= 1e-12) {
        shares = 0;
        lots.length = 0;
      }
      cash += proceeds;

      const totalEquityAfter = shares * row.price + cash;
      const cumulativeReturnDollars = totalEquityAfter - request.initial_capital;
      trades.push({
        date: row.date,
        action: "SELL",
        price: roundMoney(row.price),
        shares: roundFloat(sharesToSell),
        trade_value: roundMoney(proceeds),
        percent_change: costBasis === 0 ? null : roundPercent(((proceeds - costBasis) / costBasis) * 100),
        cumulative_return_dollars: roundMoney(cumulativeReturnDollars),
        cumulative_return_percentage: roundPercent((cumulativeReturnDollars / request.initial_capital) * 100),
        cash_after: roundMoney(cash),
        position_value_after: roundMoney(shares * row.price),
        total_equity_after: roundMoney(totalEquityAfter)
      });
    }

    equityCurve.push({
      date: row.date,
      portfolio_value: roundMoney(cash + shares * row.price),
      cash: roundMoney(cash),
      shares: roundFloat(shares),
      price: roundMoney(row.price)
    });
  }

  return {
    price_series: frame.map((row) => ({
      date: row.date,
      price: roundMoney(row.price)
    })),
    bands: frame.map((row) => ({
      date: row.date,
      moving_average: row.moving_average === null ? null : roundMoney(row.moving_average),
      upper_band: row.upper_band === null ? null : roundMoney(row.upper_band),
      lower_band: row.lower_band === null ? null : roundMoney(row.lower_band)
    })),
    trades,
    equity_curve: equityCurve
  };
}

function runBuyAndHoldBenchmark(rows: { date: string; price: number }[], initialCapital: number): EquityPoint[] {
  if (rows.length === 0) {
    throw new Error("No benchmark rows were available for the selected date range.");
  }

  const firstPrice = rows[0]?.price;
  if (!isFiniteNumber(firstPrice)) {
    throw new Error("Benchmark rows only contained missing adjusted_close values.");
  }

  const shares = initialCapital / firstPrice;
  return rows.map((row) => ({
    date: row.date,
    portfolio_value: roundMoney(shares * row.price),
    cash: roundMoney(0),
    shares: roundFloat(shares),
    price: roundMoney(row.price)
  }));
}

function calculateSummary(
  initialCapital: number,
  strategyEquityCurve: EquityPoint[],
  benchmarkEquityCurve: EquityPoint[],
  trades: Trade[]
): SummaryMetrics {
  const strategyEndingValue = strategyEquityCurve[strategyEquityCurve.length - 1]?.portfolio_value;
  const benchmarkEndingValue = benchmarkEquityCurve[benchmarkEquityCurve.length - 1]?.portfolio_value;

  if (!isFiniteNumber(strategyEndingValue)) {
    throw new Error("Strategy equity curve is empty.");
  }
  if (!isFiniteNumber(benchmarkEndingValue)) {
    throw new Error("Benchmark equity curve is empty.");
  }

  const strategyReturnDollars = strategyEndingValue - initialCapital;
  const benchmarkReturnDollars = benchmarkEndingValue - initialCapital;
  const strategyReturnPercentage = (strategyReturnDollars / initialCapital) * 100;
  const benchmarkReturnPercentage = (benchmarkReturnDollars / initialCapital) * 100;

  return {
    starting_capital: roundMoney(initialCapital),
    ending_value: roundMoney(strategyEndingValue),
    total_return_percentage: roundPercent(strategyReturnPercentage),
    total_return_dollars: roundMoney(strategyReturnDollars),
    number_of_trades: trades.length,
    benchmark_ending_value: roundMoney(benchmarkEndingValue),
    benchmark_return_percentage: roundPercent(benchmarkReturnPercentage),
    benchmark_return_dollars: roundMoney(benchmarkReturnDollars),
    strategy_vs_benchmark_dollar_difference: roundMoney(strategyEndingValue - benchmarkEndingValue),
    strategy_vs_benchmark_percentage_point_difference: roundPercent(
      strategyReturnPercentage - benchmarkReturnPercentage
    )
  };
}

export async function runBollingerVsBenchmark(
  request: BacktestRequest,
  client: StockDataClient
): Promise<BacktestResponse> {
  if (request.start_date > request.end_date) {
    throw new Error("start_date must be on or before end_date.");
  }

  const symbol = request.symbol.trim().toUpperCase();
  const benchmarkSymbol = request.benchmark_symbol.trim().toUpperCase();
  const [symbolPrices, benchmarkPrices] = await Promise.all([
    client.getWeeklyPrices(symbol),
    client.getWeeklyPrices(benchmarkSymbol)
  ]);

  const selectedRows = selectPriceRows(symbolPrices, request.start_date, request.end_date);
  const benchmarkRows = selectPriceRows(benchmarkPrices, request.start_date, request.end_date);
  const strategyResult = runBollingerBacktest(selectedRows, request);
  const benchmarkEquityCurve = runBuyAndHoldBenchmark(benchmarkRows, request.initial_capital);
  const summary = calculateSummary(
    request.initial_capital,
    strategyResult.equity_curve,
    benchmarkEquityCurve,
    strategyResult.trades
  );

  return {
    symbol,
    benchmark_symbol: benchmarkSymbol,
    start_date: request.start_date,
    end_date: request.end_date,
    parameters: {
      initial_capital: request.initial_capital,
      window: request.window,
      std_dev: request.std_dev,
      trade_capital_percentage: request.trade_capital_percentage
    },
    price_series: strategyResult.price_series,
    bollinger_bands: strategyResult.bands,
    trades: strategyResult.trades,
    bollinger_equity_curve: strategyResult.equity_curve,
    spy_equity_curve: benchmarkEquityCurve,
    summary
  };
}
