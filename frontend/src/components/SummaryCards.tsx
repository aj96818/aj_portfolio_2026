import type { BacktestResponse } from "../types";

type SummaryCardsProps = {
  data: BacktestResponse;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

export function SummaryCards({ data }: SummaryCardsProps) {
  const { summary, parameters } = data;
  const cards = [
    ["Starting capital", money.format(summary.starting_capital)],
    ["Bollinger ending value", money.format(summary.ending_value)],
    [`${data.benchmark_symbol} ending value`, money.format(summary.benchmark_ending_value)],
    ["Bollinger total return", `${percent.format(summary.total_return_percentage)}%`],
    [`${data.benchmark_symbol} total return`, `${percent.format(summary.benchmark_return_percentage)}%`],
    ["Ending value difference", money.format(summary.strategy_vs_benchmark_dollar_difference)],
    ["Number of trades", summary.number_of_trades.toString()],
    [
      "Parameters",
      `${parameters.window}w / ${parameters.std_dev} std dev / ${parameters.trade_capital_percentage}% per trade`
    ]
  ];

  return (
    <section className="summary-grid" aria-label="Performance summary">
      {cards.map(([label, value]) => (
        <article className="summary-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
