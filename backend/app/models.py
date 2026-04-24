from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class PriceRow:
    symbol: str
    week_date: date
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    adjusted_close: float | None
    volume: int | None
    dividend: float | None
