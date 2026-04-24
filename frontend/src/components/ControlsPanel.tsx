import { Play } from "lucide-react";

import type { BacktestRequest, DateRange } from "../types";

type ControlsPanelProps = {
  symbols: string[];
  dateRange: DateRange | null;
  request: BacktestRequest;
  isLoading: boolean;
  onRequestChange: (request: BacktestRequest) => void;
  onRun: () => void;
};

const toDate = (value: string) => new Date(`${value}T00:00:00`);

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const dayOffset = (start: string, value: string) => {
  const diff = toDate(value).getTime() - toDate(start).getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
};

const dateFromOffset = (start: string, offset: number) => {
  const date = toDate(start);
  date.setDate(date.getDate() + offset);
  return toInputDate(date);
};

const totalDays = (range: DateRange) => dayOffset(range.min_date, range.max_date);

export function ControlsPanel({
  symbols,
  dateRange,
  request,
  isLoading,
  onRequestChange,
  onRun
}: ControlsPanelProps) {
  const update = <K extends keyof BacktestRequest>(key: K, value: BacktestRequest[K]) => {
    onRequestChange({ ...request, [key]: value });
  };

  const updateSymbol = (key: "symbol" | "benchmark_symbol", value: string) => {
    update(key, value.trim().toUpperCase());
  };

  const rangeDays = dateRange ? totalDays(dateRange) : 0;
  const startOffset = dateRange ? dayOffset(dateRange.min_date, request.start_date) : 0;
  const endOffset = dateRange ? dayOffset(dateRange.min_date, request.end_date) : 0;
  const tradeValue = (request.initial_capital * request.trade_capital_percentage) / 100;

  return (
    <section className="controls-panel" aria-label="Backtest controls">
      <datalist id="symbol-options">
        {symbols.map((symbol) => (
          <option key={symbol} value={symbol} />
        ))}
      </datalist>

      <div className="control-group symbol-control">
        <label htmlFor="symbol">Symbol</label>
        <input
          id="symbol"
          type="text"
          list="symbol-options"
          value={request.symbol}
          onChange={(event) => updateSymbol("symbol", event.target.value)}
          placeholder="Search symbol"
          disabled={symbols.length === 0 || isLoading}
        />
      </div>

      <div className="control-group symbol-control">
        <label htmlFor="benchmark-symbol">Benchmark symbol</label>
        <input
          id="benchmark-symbol"
          type="text"
          list="symbol-options"
          value={request.benchmark_symbol}
          onChange={(event) => updateSymbol("benchmark_symbol", event.target.value)}
          placeholder="Search benchmark"
          disabled={symbols.length === 0 || isLoading}
        />
      </div>

      <div className="control-group">
        <label htmlFor="start-date">Start date</label>
        <input
          id="start-date"
          type="date"
          value={request.start_date}
          min={dateRange?.min_date}
          max={request.end_date}
          onChange={(event) => update("start_date", event.target.value)}
          disabled={!dateRange || isLoading}
        />
        <input
          aria-label="Start date slider"
          type="range"
          min={0}
          max={rangeDays}
          value={startOffset}
          onChange={(event) => {
            if (!dateRange) return;
            const nextStart = dateFromOffset(dateRange.min_date, Number(event.target.value));
            if (nextStart <= request.end_date) update("start_date", nextStart);
          }}
          disabled={!dateRange || isLoading}
        />
      </div>

      <div className="control-group">
        <label htmlFor="end-date">End date</label>
        <input
          id="end-date"
          type="date"
          value={request.end_date}
          min={request.start_date}
          max={dateRange?.max_date}
          onChange={(event) => update("end_date", event.target.value)}
          disabled={!dateRange || isLoading}
        />
        <input
          aria-label="End date slider"
          type="range"
          min={0}
          max={rangeDays}
          value={endOffset}
          onChange={(event) => {
            if (!dateRange) return;
            const nextEnd = dateFromOffset(dateRange.min_date, Number(event.target.value));
            if (nextEnd >= request.start_date) update("end_date", nextEnd);
          }}
          disabled={!dateRange || isLoading}
        />
      </div>

      <div className="control-row">
        <div className="control-group compact">
          <label htmlFor="window">Window</label>
          <input
            id="window"
            type="number"
            min={2}
            max={260}
            value={request.window}
            onChange={(event) => update("window", Number(event.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="control-group compact">
          <label htmlFor="std-dev">Std dev threshold</label>
          <input
            id="std-dev"
            type="number"
            min={0.5}
            max={5}
            step={0.5}
            value={request.std_dev}
            onChange={(event) => update("std_dev", Number(event.target.value))}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="control-group">
        <label htmlFor="capital">Starting capital</label>
        <input
          id="capital"
          type="number"
          min={1}
          step={100}
          value={request.initial_capital}
          onChange={(event) => update("initial_capital", Number(event.target.value))}
          disabled={isLoading}
        />
      </div>

      <div className="control-group">
        <div className="split-label">
          <label htmlFor="trade-capital">Capital per trade</label>
          <span>{request.trade_capital_percentage}%</span>
        </div>
        <input
          id="trade-capital"
          type="range"
          min={1}
          max={100}
          step={1}
          value={request.trade_capital_percentage}
          onChange={(event) => update("trade_capital_percentage", Number(event.target.value))}
          disabled={isLoading}
        />
        <div className="control-note">
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
          }).format(tradeValue)}{" "}
          per buy or sell signal
        </div>
      </div>

      <button className="run-button" onClick={onRun} disabled={!dateRange || isLoading}>
        <Play size={18} aria-hidden="true" />
        {isLoading ? "Running..." : "Run Backtest"}
      </button>
    </section>
  );
}
