def calculate_summary(
    initial_capital: float,
    strategy_equity_curve: list[dict],
    benchmark_equity_curve: list[dict],
    trades: list[dict],
) -> dict:
    if not strategy_equity_curve:
        raise ValueError("Strategy equity curve is empty.")
    if not benchmark_equity_curve:
        raise ValueError("Benchmark equity curve is empty.")

    ending_value = float(strategy_equity_curve[-1]["portfolio_value"])
    benchmark_ending_value = float(benchmark_equity_curve[-1]["portfolio_value"])
    strategy_return_dollars = ending_value - initial_capital
    benchmark_return_dollars = benchmark_ending_value - initial_capital
    strategy_return_pct = strategy_return_dollars / initial_capital * 100
    benchmark_return_pct = benchmark_return_dollars / initial_capital * 100

    return {
        "starting_capital": round(float(initial_capital), 2),
        "ending_value": round(ending_value, 2),
        "total_return_percentage": round(strategy_return_pct, 2),
        "total_return_dollars": round(strategy_return_dollars, 2),
        "number_of_trades": len(trades),
        "benchmark_ending_value": round(benchmark_ending_value, 2),
        "benchmark_return_percentage": round(benchmark_return_pct, 2),
        "benchmark_return_dollars": round(benchmark_return_dollars, 2),
        "strategy_vs_benchmark_dollar_difference": round(
            ending_value - benchmark_ending_value,
            2,
        ),
        "strategy_vs_benchmark_percentage_point_difference": round(
            strategy_return_pct - benchmark_return_pct,
            2,
        ),
    }
