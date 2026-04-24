from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    database: str


class SymbolsResponse(BaseModel):
    symbols: list[str]


class DateRangeResponse(BaseModel):
    symbol: str
    min_date: date
    max_date: date


class BollingerBacktestRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=24)
    benchmark_symbol: str = Field("SPY", min_length=1, max_length=24)
    start_date: date
    end_date: date
    initial_capital: float = Field(10_000, gt=0)
    window: int = Field(20, ge=2, le=260)
    std_dev: float = Field(2, ge=0.5, le=5)
    trade_capital_percentage: float = Field(10, gt=0, le=100)


class PricePoint(BaseModel):
    date: date
    price: float


class BollingerPoint(BaseModel):
    date: date
    moving_average: float | None
    upper_band: float | None
    lower_band: float | None


class Trade(BaseModel):
    date: date
    action: Literal["BUY", "SELL"]
    price: float
    shares: float
    trade_value: float
    percent_change: float | None
    cumulative_return_dollars: float
    cumulative_return_percentage: float
    cash_after: float
    position_value_after: float
    total_equity_after: float


class EquityPoint(BaseModel):
    date: date
    portfolio_value: float
    cash: float
    shares: float
    price: float


class BacktestParameters(BaseModel):
    initial_capital: float
    window: int
    std_dev: float
    trade_capital_percentage: float


class SummaryMetrics(BaseModel):
    starting_capital: float
    ending_value: float
    total_return_percentage: float
    total_return_dollars: float
    number_of_trades: int
    benchmark_ending_value: float
    benchmark_return_percentage: float
    benchmark_return_dollars: float
    strategy_vs_benchmark_dollar_difference: float
    strategy_vs_benchmark_percentage_point_difference: float


class BollingerVsSpyResponse(BaseModel):
    symbol: str
    benchmark_symbol: str
    start_date: date
    end_date: date
    parameters: BacktestParameters
    price_series: list[PricePoint]
    bollinger_bands: list[BollingerPoint]
    trades: list[Trade]
    bollinger_equity_curve: list[EquityPoint]
    spy_equity_curve: list[EquityPoint]
    summary: SummaryMetrics
