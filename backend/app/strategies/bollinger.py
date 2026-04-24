from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class BollingerBacktestResult:
    price_series: list[dict]
    bands: list[dict]
    trades: list[dict]
    equity_curve: list[dict]


def _round_money(value: float) -> float:
    return round(float(value), 2)


def _round_float(value: float) -> float:
    return round(float(value), 6)


def _round_percent(value: float) -> float:
    return round(float(value), 2)


def run_bollinger_backtest(
    prices: pd.DataFrame,
    initial_capital: float,
    window: int,
    std_dev: float,
    trade_capital_percentage: float,
) -> BollingerBacktestResult:
    if prices.empty:
        raise ValueError("No price rows were available for the selected symbol and date range.")

    frame = prices.copy()
    frame = frame.rename(columns={"week_date": "date", "adjusted_close": "price"})
    frame["price"] = pd.to_numeric(frame["price"], errors="coerce")
    frame = frame.dropna(subset=["price"]).sort_values("date").reset_index(drop=True)

    if len(frame) < window:
        raise ValueError(
            f"Need at least {window} adjusted weekly prices to compute Bollinger Bands; found {len(frame)}."
        )

    frame["moving_average"] = frame["price"].rolling(window=window).mean()
    frame["rolling_std"] = frame["price"].rolling(window=window).std()
    frame["upper_band"] = frame["moving_average"] + std_dev * frame["rolling_std"]
    frame["lower_band"] = frame["moving_average"] - std_dev * frame["rolling_std"]

    cash = float(initial_capital)
    shares = 0.0
    trade_notional = float(initial_capital) * float(trade_capital_percentage) / 100
    lots: list[dict] = []
    trades: list[dict] = []
    equity_curve: list[dict] = []

    if trade_notional <= 0:
        raise ValueError("Trade capital percentage must produce a positive trade amount.")

    for row in frame.itertuples(index=False):
        price = float(row.price)
        has_bands = pd.notna(row.upper_band) and pd.notna(row.lower_band)

        # Signals use the same weekly close as execution, matching the requested
        # first-version rule. A later version can shift signals one bar to make
        # execution timing more conservative.
        if has_bands and price <= float(row.lower_band) and cash > 0:
            trade_value = min(cash, trade_notional)
            bought_shares = trade_value / price
            shares += bought_shares
            cash -= trade_value
            lots.append({"shares": bought_shares, "price": price})
            total_equity_after = shares * price + cash
            cumulative_return_dollars = total_equity_after - float(initial_capital)
            trades.append(
                {
                    "date": row.date,
                    "action": "BUY",
                    "price": _round_money(price),
                    "shares": _round_float(bought_shares),
                    "trade_value": _round_money(trade_value),
                    "percent_change": None,
                    "cumulative_return_dollars": _round_money(cumulative_return_dollars),
                    "cumulative_return_percentage": _round_percent(
                        cumulative_return_dollars / float(initial_capital) * 100
                    ),
                    "cash_after": _round_money(cash),
                    "position_value_after": _round_money(shares * price),
                    "total_equity_after": _round_money(total_equity_after),
                }
            )
        elif has_bands and price >= float(row.upper_band) and shares > 0:
            target_sale_value = min(shares * price, trade_notional)
            shares_to_sell = target_sale_value / price
            remaining_to_sell = shares_to_sell
            cost_basis = 0.0

            while remaining_to_sell > 0 and lots:
                lot = lots[0]
                lot_shares = float(lot["shares"])
                sold_from_lot = min(lot_shares, remaining_to_sell)
                cost_basis += sold_from_lot * float(lot["price"])
                lot["shares"] = lot_shares - sold_from_lot
                remaining_to_sell -= sold_from_lot
                if lot["shares"] <= 1e-12:
                    lots.pop(0)

            proceeds = shares_to_sell * price
            shares -= shares_to_sell
            if shares <= 1e-12:
                shares = 0.0
                lots.clear()
            cash += proceeds
            total_equity_after = shares * price + cash
            cumulative_return_dollars = total_equity_after - float(initial_capital)
            trades.append(
                {
                    "date": row.date,
                    "action": "SELL",
                    "price": _round_money(price),
                    "shares": _round_float(shares_to_sell),
                    "trade_value": _round_money(proceeds),
                    "percent_change": (
                        None if cost_basis == 0 else _round_percent((proceeds - cost_basis) / cost_basis * 100)
                    ),
                    "cumulative_return_dollars": _round_money(cumulative_return_dollars),
                    "cumulative_return_percentage": _round_percent(
                        cumulative_return_dollars / float(initial_capital) * 100
                    ),
                    "cash_after": _round_money(cash),
                    "position_value_after": _round_money(shares * price),
                    "total_equity_after": _round_money(total_equity_after),
                }
            )

        equity_curve.append(
            {
                "date": row.date,
                "portfolio_value": _round_money(cash + shares * price),
                "cash": _round_money(cash),
                "shares": _round_float(shares),
                "price": _round_money(price),
            }
        )

    price_series = [
        {"date": row.date, "price": _round_money(row.price)}
        for row in frame.itertuples(index=False)
    ]
    bands = [
        {
            "date": row.date,
            "moving_average": None if pd.isna(row.moving_average) else _round_money(row.moving_average),
            "upper_band": None if pd.isna(row.upper_band) else _round_money(row.upper_band),
            "lower_band": None if pd.isna(row.lower_band) else _round_money(row.lower_band),
        }
        for row in frame.itertuples(index=False)
    ]

    return BollingerBacktestResult(
        price_series=price_series,
        bands=bands,
        trades=trades,
        equity_curve=equity_curve,
    )
