import type { BacktestResponse, Trade } from "../types";
import { Plot } from "./PlotlyChart";

type PriceChartProps = {
  data: BacktestResponse;
};

const markerSeries = (trades: Trade[], action: "BUY" | "SELL") =>
  trades.filter((trade) => trade.action === action);

export function PriceChart({ data }: PriceChartProps) {
  const buyTrades = markerSeries(data.trades, "BUY");
  const sellTrades = markerSeries(data.trades, "SELL");

  return (
    <div className="chart-shell">
      <div className="chart-title">
        <h2>{data.symbol} Price & Bollinger Bands</h2>
      </div>
      <Plot
        className="plot"
        useResizeHandler
        data={[
          {
            x: data.price_series.map((point) => point.date),
            y: data.price_series.map((point) => point.price),
            type: "scatter",
            mode: "lines",
            name: `${data.symbol} adjusted close`,
            line: { color: "#1f6feb", width: 2 }
          },
          {
            x: data.bollinger_bands.map((point) => point.date),
            y: data.bollinger_bands.map((point) => point.moving_average),
            type: "scatter",
            mode: "lines",
            name: "Moving average",
            line: { color: "#334155", width: 1.5 }
          },
          {
            x: data.bollinger_bands.map((point) => point.date),
            y: data.bollinger_bands.map((point) => point.upper_band),
            type: "scatter",
            mode: "lines",
            name: "Upper band",
            line: { color: "#d97706", width: 1.5, dash: "dot" }
          },
          {
            x: data.bollinger_bands.map((point) => point.date),
            y: data.bollinger_bands.map((point) => point.lower_band),
            type: "scatter",
            mode: "lines",
            name: "Lower band",
            line: { color: "#0f766e", width: 1.5, dash: "dot" }
          },
          {
            x: buyTrades.map((trade) => trade.date),
            y: buyTrades.map((trade) => trade.price),
            type: "scatter",
            mode: "markers",
            name: "Buy",
            marker: { color: "#f97316", size: 10, symbol: "circle" }
          },
          {
            x: sellTrades.map((trade) => trade.date),
            y: sellTrades.map((trade) => trade.price),
            type: "scatter",
            mode: "markers",
            name: "Sell",
            marker: { color: "#16a34a", size: 10, symbol: "circle" }
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
          yaxis: { title: { text: "Price" }, tickprefix: "$", gridcolor: "#e5e7eb" }
        }}
        config={{ displayModeBar: true, responsive: true }}
        style={{ width: "100%", height: "430px" }}
      />
    </div>
  );
}
