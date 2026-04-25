#!/usr/bin/env python3
"""Export a small static JSON data set for the GitHub Pages demo.

Run from the repository root after installing backend dependencies:

    source .venv/bin/activate
    python scripts/export_demo_json.py

The script reads DEMO_DATABASE_URL or DATABASE_URL from the environment. If
neither is set, it will read the project root .env file. It exports only the
demo ticker universe into frontend/public/data/demo/ and overwrites those JSON
files safely on each run.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import bindparam, create_engine, text


DEFAULT_SYMBOLS = [
    "SPY",
    "VOO",
    "VTI",
    "AAPL",
    "TSLA",
    "NVDA",
    "AMD",
    "GOOG",
    "MSFT",
    "TSMC",
    "ASML",
    "META",
    "COST",
    "NFLX",
    "INTC",
    "CVX",
    "NVO",
    "AZN",
    "HD",
    "LLY",
    "JPM",
]

TABLE_NAME = "weekly_prices"
REQUIRED_COLUMNS = {"symbol", "week_date", "adjusted_close"}
EXPORT_COLUMNS = ["symbol", "week_date", "open", "high", "low", "close", "adjusted_close", "volume"]
SOURCE_SYMBOL_ALIASES = {
    # The local weekly_prices table uses the US ADR ticker for Taiwan Semiconductor.
    "TSMC": "TSM",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        default=None,
        help="SQLAlchemy PostgreSQL connection URL. Defaults to DEMO_DATABASE_URL or DATABASE_URL.",
    )
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=DEFAULT_SYMBOLS,
        help="Ticker symbols to export. Defaults to the GitHub Pages demo universe.",
    )
    parser.add_argument(
        "--output-dir",
        default="frontend/public/data/demo",
        help="Output directory for symbols.json and weekly_prices/*.json.",
    )
    return parser.parse_args()


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def to_json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()[:10]
    if isinstance(value, Decimal):
        return float(value)
    return value


def numeric_or_none(value: Any) -> float | None:
    converted = to_json_value(value)
    if converted is None:
        return None
    return float(converted)


def int_or_none(value: Any) -> int | None:
    converted = to_json_value(value)
    if converted is None:
        return None
    return int(converted)


def compact_price_row(row: dict[str, Any], output_symbol: str) -> dict[str, Any]:
    adjusted_close = numeric_or_none(row.get("adjusted_close"))
    close = numeric_or_none(row.get("close")) or adjusted_close
    if adjusted_close is None or close is None:
        raise ValueError("Rows passed to compact_price_row must include adjusted_close or close.")

    open_price = numeric_or_none(row.get("open")) or close
    high = numeric_or_none(row.get("high")) or max(open_price, close)
    low = numeric_or_none(row.get("low")) or min(open_price, close)
    volume = int_or_none(row.get("volume"))

    output = {
        "symbol": output_symbol,
        "week_date": to_json_value(row["week_date"]),
        "open": open_price,
        "high": high,
        "low": low,
        "close": close,
        "adjusted_close": adjusted_close,
    }
    if volume is not None:
        output["volume"] = volume
    return output


def get_weekly_price_columns(connection: Any) -> set[str]:
    rows = connection.execute(
        text(
            """
            select column_name
            from information_schema.columns
            where table_schema = current_schema()
              and table_name = :table_name
            """
        ),
        {"table_name": TABLE_NAME},
    ).scalars()
    return {str(column) for column in rows}


def export_demo_json(database_url: str, symbols: list[str], output_dir: Path) -> None:
    normalized_symbols = [symbol.upper() for symbol in symbols]
    source_symbols_by_output = {
        symbol: SOURCE_SYMBOL_ALIASES.get(symbol, symbol) for symbol in normalized_symbols
    }
    source_symbols = sorted(set(source_symbols_by_output.values()))
    engine = create_engine(database_url)

    with engine.connect() as connection:
        columns = get_weekly_price_columns(connection)
        missing_required = REQUIRED_COLUMNS - columns
        if missing_required:
            missing = ", ".join(sorted(missing_required))
            raise RuntimeError(f"{TABLE_NAME} is missing required columns: {missing}")

        select_list = ", ".join(
            column if column in columns else f"null as {column}" for column in EXPORT_COLUMNS
        )
        query = text(
            f"""
            select {select_list}
            from {TABLE_NAME}
            where upper(symbol) in :symbols
              and adjusted_close is not null
            order by upper(symbol), week_date
            """
        ).bindparams(bindparam("symbols", expanding=True))
        rows = connection.execute(query, {"symbols": source_symbols}).mappings().all()

    grouped_rows_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        row_dict = dict(row)
        grouped_rows_by_source[str(row_dict["symbol"]).upper()].append(row_dict)

    grouped_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for output_symbol, source_symbol in source_symbols_by_output.items():
        for row in grouped_rows_by_source.get(source_symbol, []):
            grouped_rows[output_symbol].append(compact_price_row(row, output_symbol))

    missing_symbols = [symbol for symbol in normalized_symbols if not grouped_rows.get(symbol)]
    if missing_symbols:
        missing = ", ".join(missing_symbols)
        print(f"Warning: no adjusted weekly price rows found for: {missing}")

    weekly_prices_dir = output_dir / "weekly_prices"
    weekly_prices_dir.mkdir(parents=True, exist_ok=True)

    for stale_file in weekly_prices_dir.glob("*.json"):
        stale_file.unlink()

    output_symbols = [symbol for symbol in normalized_symbols if grouped_rows[symbol]]
    if not output_symbols:
        raise RuntimeError("No demo symbols could be exported.")

    (output_dir / "symbols.json").write_text(
        json.dumps(output_symbols, indent=2) + "\n",
        encoding="utf-8",
    )

    for symbol in output_symbols:
        symbol_rows = sorted(grouped_rows[symbol], key=lambda price: price["week_date"])
        (weekly_prices_dir / f"{symbol}.json").write_text(
            json.dumps(symbol_rows, indent=2) + "\n",
            encoding="utf-8",
        )

    print(f"Exported {len(output_symbols)} symbols to {output_dir}")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    load_dotenv(repo_root / ".env")
    args = parse_args()
    database_url = args.database_url or os.environ.get("DEMO_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DEMO_DATABASE_URL or DATABASE_URL, or add DATABASE_URL to .env.")

    export_demo_json(
        database_url=database_url,
        symbols=args.symbols,
        output_dir=(repo_root / args.output_dir).resolve(),
    )


if __name__ == "__main__":
    main()
