import pandas as pd


def _round_money(value: float) -> float:
    return round(float(value), 2)


def _round_float(value: float) -> float:
    return round(float(value), 6)


def run_buy_and_hold_benchmark(prices: pd.DataFrame, initial_capital: float) -> list[dict]:
    if prices.empty:
        raise ValueError("No benchmark rows were available for the selected date range.")

    frame = prices.copy()
    frame = frame.rename(columns={"week_date": "date", "adjusted_close": "price"})
    frame["price"] = pd.to_numeric(frame["price"], errors="coerce")
    frame = frame.dropna(subset=["price"]).sort_values("date").reset_index(drop=True)

    if frame.empty:
        raise ValueError("Benchmark rows only contained missing adjusted_close values.")

    first_price = float(frame.iloc[0]["price"])
    shares = float(initial_capital) / first_price

    return [
        {
            "date": row.date,
            "portfolio_value": _round_money(shares * float(row.price)),
            "cash": _round_money(0),
            "shares": _round_float(shares),
            "price": _round_money(row.price),
        }
        for row in frame.itertuples(index=False)
    ]
