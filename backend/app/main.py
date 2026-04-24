from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.metrics.performance import calculate_summary
from app.schemas import (
    BollingerBacktestRequest,
    BollingerVsSpyResponse,
    DateRangeResponse,
    HealthResponse,
    SymbolsResponse,
)
from app.services.price_service import (
    MissingSchemaError,
    get_date_range,
    list_symbols,
    load_adjusted_weekly_prices,
    validate_weekly_prices_schema,
)
from app.strategies.benchmark import run_buy_and_hold_benchmark
from app.strategies.bollinger import run_bollinger_backtest


settings = get_settings()

app = FastAPI(
    title="Trading Strategy Visualizer API",
    version="0.1.0",
    description="Local-first Bollinger Band backtesting API using weekly PostgreSQL price data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    try:
        validate_weekly_prices_schema(db)
    except MissingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {exc}") from exc

    return HealthResponse(status="ok", database="av_weekly_etl")


@app.get("/symbols", response_model=SymbolsResponse)
def symbols(db: Session = Depends(get_db)) -> SymbolsResponse:
    try:
        return SymbolsResponse(symbols=list_symbols(db))
    except MissingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load symbols: {exc}") from exc


@app.get("/date-range/{symbol}", response_model=DateRangeResponse)
def date_range(symbol: str, db: Session = Depends(get_db)) -> DateRangeResponse:
    try:
        result = get_date_range(db, symbol)
    except MissingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load date range: {exc}") from exc

    if result is None:
        raise HTTPException(status_code=404, detail=f"No adjusted weekly prices found for {symbol.upper()}.")

    min_date, max_date = result
    return DateRangeResponse(symbol=symbol.upper(), min_date=min_date, max_date=max_date)


@app.post("/backtest/bollinger-vs-spy", response_model=BollingerVsSpyResponse)
def bollinger_vs_spy(
    request: BollingerBacktestRequest,
    db: Session = Depends(get_db),
) -> BollingerVsSpyResponse:
    if request.start_date > request.end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date.")

    symbol = request.symbol.upper()
    benchmark_symbol = request.benchmark_symbol.upper()

    try:
        selected_prices = load_adjusted_weekly_prices(
            db=db,
            symbol=symbol,
            start_date=request.start_date,
            end_date=request.end_date,
        )
        benchmark_prices = load_adjusted_weekly_prices(
            db=db,
            symbol=benchmark_symbol,
            start_date=request.start_date,
            end_date=request.end_date,
        )
        if benchmark_prices.empty:
            benchmark_range = get_date_range(db, benchmark_symbol)
            if benchmark_range is None:
                raise ValueError(
                    f"{benchmark_symbol} benchmark data is not present in weekly_prices with non-null "
                    "adjusted_close values. Import weekly prices for that symbol into the local database "
                    "before running this comparison."
                )
            benchmark_min_date, benchmark_max_date = benchmark_range
            raise ValueError(
                f"No {benchmark_symbol} benchmark rows were available for the selected date range. "
                f"{benchmark_symbol} adjusted weekly data is available from {benchmark_min_date} "
                f"to {benchmark_max_date}."
            )
        strategy_result = run_bollinger_backtest(
            prices=selected_prices,
            initial_capital=request.initial_capital,
            window=request.window,
            std_dev=request.std_dev,
            trade_capital_percentage=request.trade_capital_percentage,
        )
        benchmark_equity_curve = run_buy_and_hold_benchmark(
            prices=benchmark_prices,
            initial_capital=request.initial_capital,
        )
        summary = calculate_summary(
            initial_capital=request.initial_capital,
            strategy_equity_curve=strategy_result.equity_curve,
            benchmark_equity_curve=benchmark_equity_curve,
            trades=strategy_result.trades,
        )
    except MissingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load price data: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return BollingerVsSpyResponse(
        symbol=symbol,
        benchmark_symbol=benchmark_symbol,
        start_date=request.start_date,
        end_date=request.end_date,
        parameters={
            "initial_capital": request.initial_capital,
            "window": request.window,
            "std_dev": request.std_dev,
            "trade_capital_percentage": request.trade_capital_percentage,
        },
        price_series=strategy_result.price_series,
        bollinger_bands=strategy_result.bands,
        trades=strategy_result.trades,
        bollinger_equity_curve=strategy_result.equity_curve,
        spy_equity_curve=benchmark_equity_curve,
        summary=summary,
    )
