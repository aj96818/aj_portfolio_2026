# Trading Strategy Visualizer

A local-first web app for comparing a weekly Bollinger Band trading strategy against a searchable buy-and-hold benchmark, defaulting to SPY. The backend reads your existing PostgreSQL `av_weekly_etl` database and never writes to it.

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy 2.x, psycopg, pandas
- Frontend: React, Vite, TypeScript
- Charts: Plotly via `react-plotly.js`
- Database: local PostgreSQL table `weekly_prices`

## Required Local Database

The app expects a local PostgreSQL database named `av_weekly_etl` with a table named `weekly_prices`.

Required read columns:

- `symbol`
- `week_date`
- `adjusted_close`

The original expected table may also include `open`, `high`, `low`, `close`, `volume`, and `dividend`. The backend inspects `information_schema.columns` before querying and returns a clear API error if required columns are missing.

## Environment Variables

Create a local `.env` from the example:

```bash
cp .env.example .env
```

Then edit:

```bash
DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/av_weekly_etl
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Do not commit `.env`.

## Backend Setup

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Run FastAPI:

```bash
uvicorn app.main:app --app-dir backend --reload
```

Check the API:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/symbols
```

## Frontend Setup

From the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## API Endpoints

- `GET /health`
- `GET /symbols`
- `GET /date-range/{symbol}`
- `POST /backtest/bollinger-vs-spy`

Example backtest request:

```json
{
  "symbol": "AAPL",
  "benchmark_symbol": "SPY",
  "start_date": "2020-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 10000,
  "window": 20,
  "std_dev": 2.5,
  "trade_capital_percentage": 10
}
```

## Troubleshooting

If a backtest returns a benchmark data error, your `weekly_prices` table does not currently include rows with non-null `adjusted_close` values for the selected benchmark symbol. SPY is the default benchmark, but you can choose any symbol that exists in the local table.

Confirm from a Postgres terminal:

```sql
select symbol, count(*) as rows, count(adjusted_close) as adjusted_rows,
       min(week_date) as min_date, max(week_date) as max_date
from weekly_prices
where upper(symbol) = 'SPY'
group by symbol;
```

If that query returns no rows, import SPY into the same weekly ETL process you used for the other symbols or choose another available benchmark symbol, then restart or re-run the backtest.

## Current Strategy Assumptions

- Uses weekly rows from `weekly_prices`.
- Uses `adjusted_close`; rows with missing adjusted prices are dropped.
- Data is sorted by `week_date` ascending.
- Long-only strategy with fractional shares.
- Starting capital defaults to `$10,000`.
- Capital per trade defaults to `10%` of starting capital.
- No transaction costs or slippage.
- Buy with the selected trade allocation each time price is at or below the lower Bollinger Band.
- Sell up to the selected trade allocation each time price is at or above the upper Bollinger Band and shares are held.
- Execution uses the same row's adjusted weekly close. This matches the requested first version; a later version can shift signals one bar for more conservative execution timing.
- Bollinger window defaults to 20 weeks.
- Standard deviation multiplier supports fractional thresholds from 0.5 to 5, defaulting to 2.
- The benchmark buys at the first available weekly adjusted close for the selected benchmark symbol in the selected period and holds through the end.

## Project Structure

```text
backend/
  app/
    main.py
    database.py
    schemas.py
    services/price_service.py
    strategies/bollinger.py
    strategies/benchmark.py
    metrics/performance.py
frontend/
  src/
    App.tsx
    api/client.ts
    components/
    types.ts
```

## Future Roadmap

- Daily price support from Alpha Vantage
- More strategies
- Portfolio-level backtesting
- Saved strategies
- User accounts
- Stripe subscriptions
- Alerts
- Cloud deployment
- AI-generated strategy explanations
