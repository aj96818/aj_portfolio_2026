import type { BacktestResponse } from "../types";
import { Plot } from "./PlotlyChart";

type EquityCurveChartProps = {
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

const formatPercent = (value: number | null) => (value === null ? "-" : `${percent.format(value)}%`);

const formatCumulativeReturn = (dollars: number, percentage: number) =>
  `${money.format(dollars)} (${percent.format(percentage)}%)`;

export function EquityCurveChart({ data }: EquityCurveChartProps) {
  const finalReturn = formatCumulativeReturn(
    data.summary.total_return_dollars,
    data.summary.total_return_percentage
  );

  return (
    <div className="chart-shell">
      <div className="trade-table-wrap">
        <div className="chart-title">
          <h2>Trades</h2>
        </div>
        <div className="table-scroll">
          <table className="trade-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Price</th>
                <th>Shares</th>
                <th>Trade value</th>
                <th>Realized change</th>
                <th>Cumulative return</th>
              </tr>
            </thead>
            <tbody>
              {data.trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table">
                    No trades were triggered for this range.
                  </td>
                </tr>
              ) : (
                data.trades.map((trade, index) => (
                  <tr key={`${trade.date}-${trade.action}-${index}`}>
                    <td>{trade.date}</td>
                    <td>
                      <span className={`trade-badge ${trade.action.toLowerCase()}`}>{trade.action}</span>
                    </td>
                    <td>{money.format(trade.price)}</td>
                    <td>{trade.shares.toFixed(4)}</td>
                    <td>{money.format(trade.trade_value)}</td>
                    <td>{formatPercent(trade.percent_change)}</td>
                    <td>
                      {formatCumulativeReturn(
                        trade.cumulative_return_dollars,
                        trade.cumulative_return_percentage
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>Total through {data.end_date}</td>
                <td>{finalReturn}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="chart-title">
        <h2>Equity Curve</h2>
      </div>
      <Plot
        className="plot"
        useResizeHandler
        data={[
          {
            x: data.bollinger_equity_curve.map((point) => point.date),
            y: data.bollinger_equity_curve.map((point) => point.portfolio_value),
            type: "scatter",
            mode: "lines",
            name: "Bollinger strategy",
            line: { color: "#0f766e", width: 2.5 }
          },
          {
            x: data.spy_equity_curve.map((point) => point.date),
            y: data.spy_equity_curve.map((point) => point.portfolio_value),
            type: "scatter",
            mode: "lines",
            name: `${data.benchmark_symbol} buy-and-hold`,
            line: { color: "#7c3aed", width: 2.5 }
          }
        ]}
        layout={{
          autosize: true,
          margin: { t: 12, r: 24, b: 44, l: 64 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "#ffffff",
          hovermode: "x unified",
          legend: { orientation: "h", y: -0.22 },
          xaxis: { title: { text: "Week" }, gridcolor: "#e5e7eb" },
          yaxis: { title: { text: "Portfolio value" }, tickprefix: "$", gridcolor: "#e5e7eb" }
        }}
        config={{ displayModeBar: true, responsive: true }}
        style={{ width: "100%", height: "360px" }}
      />
    </div>
  );
}
