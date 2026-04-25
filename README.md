# Trading Strategy Visualizer

A React/Vite app for comparing a weekly Bollinger Band trading strategy against a buy-and-hold benchmark. The first deployable version is a free static GitHub Pages demo that reads a small ticker universe from JSON files. The local FastAPI/PostgreSQL app remains available for full local development.

## Tech Stack

- Frontend: React, Vite, TypeScript
- Charts: Plotly via `react-plotly.js`
- Static demo data: JSON files in `frontend/public/data/demo/`
- Local backend: Python, FastAPI, SQLAlchemy 2.x, psycopg, pandas
- Local database: PostgreSQL table `weekly_prices`

## Static GitHub Pages Demo

The static demo uses:

```text
frontend/public/data/demo/symbols.json
frontend/public/data/demo/weekly_prices/<SYMBOL>.json
```

Run it locally:

```bash
cd frontend
npm install
npm run dev:demo
```

Build it for GitHub Pages:

```bash
cd frontend
npm run build:demo
npm run preview:demo
```

The demo build uses `frontend/.env.demo`:

```env
VITE_APP_VARIANT=demo_static
VITE_DATA_SOURCE=static_json
VITE_FEATURE_FULL_DATA=false
VITE_FEATURE_LLM=false
VITE_FEATURE_STRIPE=false
VITE_BASE_PATH=/aj_portfolio_2026/
```

`VITE_BASE_PATH` is set for the current project Pages URL shape, `https://aj96818.github.io/aj_portfolio_2026/`. Change it to `/` if this repo is deployed as a user site or to the custom-domain path if that changes later.

## Export Demo JSON

Export a small subset from local PostgreSQL:

```bash
source .venv/bin/activate
python scripts/export_demo_json.py
```

The script reads `DEMO_DATABASE_URL` or `DATABASE_URL` from the environment, falling back to the project root `.env`. It writes `symbols.json` plus one JSON file per exported symbol under `frontend/public/data/demo/weekly_prices/`, sorted by `week_date`.

The requested demo universe is:

```text
SPY, VOO, VTI, AAPL, TSLA, NVDA, AMD, GOOG, MSFT, TSMC, ASML, META, COST, NFLX, INTC, CVX, NVO, AZN, HD, LLY, JPM
```

At the time of this export, the local database had no adjusted weekly rows for `VTI`, so the checked-in static demo includes 20 symbols. The exporter maps requested `TSMC` to local source symbol `TSM`, then writes it as `TSMC.json` for the demo. Import `VTI` into `weekly_prices` and rerun the script to include it.

## GitHub Pages Deployment

The workflow at `.github/workflows/deploy-demo-pages.yml` runs on pushes to `main` and can also be started manually. It installs frontend dependencies, runs `npm run build:demo`, uploads `frontend/dist`, and deploys it with GitHub Pages Actions.

Repository settings to enable:

1. Go to GitHub repository settings.
2. Open **Pages**.
3. Set **Build and deployment** source to **GitHub Actions**.
4. Push to `main` or run the workflow manually.

GitHub Pages is a good fit for the small demo, not the full price database. GitHub documents a 1 GB published-site limit and a 100 GB/month soft bandwidth limit, so the full data set should later move to hosted Postgres, S3/R2, or an API-backed deployment.

## Frontend Data Architecture

The frontend now uses a data-client abstraction:

```text
frontend/src/data/
  stockDataClient.ts
  staticStockDataClient.ts
  clientFactory.ts
```

Current implementation:

- `static_json`: reads JSON files from Vite public assets using `import.meta.env.BASE_URL`.

Future implementations can fit behind the same interface:

- `apiStockDataClient.ts`: hosted Postgres API data access.
- `llmStockDataClient.ts`: LLM-backed natural-language query API.

Feature flags live in `frontend/src/config/appConfig.ts`:

```ts
features: {
  fullTickerUniverse: false,
  llmAskData: false,
  stripeDownloads: false
}
```

No backend, database hosting, Stripe, LLM integration, or paid hosting is required for the current demo.

## Local FastAPI/PostgreSQL App

Create a local `.env` from the example:

```bash
cp .env.example .env
```

Then edit:

```bash
DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/av_weekly_etl
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Install backend dependencies:

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

The backend expects a local PostgreSQL database named `av_weekly_etl` with table `weekly_prices`.

Required read columns:

- `symbol`
- `week_date`
- `adjusted_close`

Optional columns used when available:

- `open`
- `high`
- `low`
- `close`
- `volume`
- `dividend`

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
- Execution uses the same row's adjusted weekly close.
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
  public/data/demo/
    symbols.json
    weekly_prices/
  src/
    App.tsx
    config/appConfig.ts
    data/
    strategies/bollingerBacktest.ts
    components/
    types.ts
scripts/
  export_demo_json.py
```
