from datetime import date

import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session


TABLE_NAME = "weekly_prices"
REQUIRED_COLUMNS = {"symbol", "week_date", "adjusted_close"}
OPTIONAL_COLUMNS = ["open", "high", "low", "close", "volume", "dividend"]


class PriceServiceError(Exception):
    pass


class MissingSchemaError(PriceServiceError):
    pass


def get_weekly_prices_columns(db: Session) -> set[str]:
    rows = db.execute(
        text(
            """
            select column_name
            from information_schema.columns
            where table_schema = current_schema()
              and table_name = :table_name
            """
        ),
        {"table_name": TABLE_NAME},
    ).all()
    return {row.column_name for row in rows}


def validate_weekly_prices_schema(db: Session) -> set[str]:
    columns = get_weekly_prices_columns(db)
    missing = REQUIRED_COLUMNS - columns
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise MissingSchemaError(f"{TABLE_NAME} is missing required columns: {missing_list}")
    return columns


def list_symbols(db: Session) -> list[str]:
    validate_weekly_prices_schema(db)
    rows = db.execute(
        text(
            f"""
            select distinct symbol
            from {TABLE_NAME}
            where symbol is not null
            order by symbol
            """
        )
    ).scalars()
    return [str(symbol) for symbol in rows]


def get_date_range(db: Session, symbol: str) -> tuple[date, date] | None:
    validate_weekly_prices_schema(db)
    row = db.execute(
        text(
            f"""
            select min(week_date) as min_date, max(week_date) as max_date
            from {TABLE_NAME}
            where upper(symbol) = :symbol
              and adjusted_close is not null
            """
        ),
        {"symbol": symbol.upper()},
    ).one()
    if row.min_date is None or row.max_date is None:
        return None
    return row.min_date, row.max_date


def load_adjusted_weekly_prices(
    db: Session,
    symbol: str,
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    validate_weekly_prices_schema(db)
    query = text(
        f"""
        select
            symbol,
            week_date,
            adjusted_close
        from {TABLE_NAME}
        where upper(symbol) = :symbol
          and week_date between :start_date and :end_date
          and adjusted_close is not null
        order by week_date asc
        """
    )
    rows = db.execute(
        query,
        {
            "symbol": symbol.upper(),
            "start_date": start_date,
            "end_date": end_date,
        },
    ).mappings()
    frame = pd.DataFrame(list(rows))
    if frame.empty:
        return pd.DataFrame(columns=["symbol", "week_date", "adjusted_close"])
    frame["week_date"] = pd.to_datetime(frame["week_date"]).dt.date
    frame["adjusted_close"] = pd.to_numeric(frame["adjusted_close"], errors="coerce")
    frame = frame.dropna(subset=["adjusted_close"]).sort_values("week_date").reset_index(drop=True)
    return frame
