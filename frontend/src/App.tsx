import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, Camera, ChevronDown, House, Mail, UserRound } from "lucide-react";

import { ControlsPanel } from "./components/ControlsPanel";
import { EquityCurveChart } from "./components/EquityCurveChart";
import { PriceChart } from "./components/PriceChart";
import { StrategyTabs, strategyLabels, type StrategyId } from "./components/StrategyTabs";
import { SummaryCards } from "./components/SummaryCards";
import { appConfig, publicAssetPath } from "./config/appConfig";
import { stockDataClient } from "./data/clientFactory";
import { getDateRangeFromWeeklyPrices, runBollingerVsBenchmark } from "./strategies/bollingerBacktest";
import type { BacktestRequest, BacktestResponse, DateRange } from "./types";

type Route = "home" | "trading" | "project-2" | "project-3" | "resume" | "about" | "contact" | "photography";

type PortfolioImage = {
  id: number;
  src: string;
  label: string;
};

const routes: { id: Route; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "trading", label: "Featured Project: Trading Strategy Visualizer" },
  { id: "project-2", label: "Project 2" },
  { id: "project-3", label: "Project 3" },
  { id: "resume", label: "Resume" },
  { id: "about", label: "About Me" },
  { id: "photography", label: "Photography" },
  { id: "contact", label: "Contact" }
];

const portfolioImages: PortfolioImage[] = Array.from({ length: 12 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    src: publicAssetPath(`images/portfolio/photo-${id}.jpg`),
    label: `Photo ${id}`
  };
});

const defaultRequest: BacktestRequest = {
  symbol: "",
  benchmark_symbol: "SPY",
  start_date: "",
  end_date: "",
  initial_capital: 10_000,
  window: 20,
  std_dev: 2,
  trade_capital_percentage: 10
};

function fiveYearsBefore(dateValue: string, minDate: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setFullYear(date.getFullYear() - 5);
  const candidate = date.toISOString().slice(0, 10);
  return candidate < minDate ? minDate : candidate;
}

function routeFromHash(): Route {
  const hash = window.location.hash.replace("#", "");
  return routes.some((route) => route.id === hash) ? (hash as Route) : "home";
}

function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash());
  const [symbols, setSymbols] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [request, setRequest] = useState<BacktestRequest>(defaultRequest);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<StrategyId>("bollinger");
  const [selectedPhoto, setSelectedPhoto] = useState<PortfolioImage | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [missingImages, setMissingImages] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(routeFromHash());
      setSelectedPhoto(null);
      setProjectsOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    let mounted = true;

    stockDataClient
      .getSymbols()
      .then((nextSymbols) => {
        if (!mounted) return;
        setSymbols(nextSymbols);
        const preferredSymbol = nextSymbols.includes("AAPL") ? "AAPL" : nextSymbols[0] ?? "";
        const preferredBenchmark = nextSymbols.includes("SPY") ? "SPY" : nextSymbols[0] ?? "";
        setRequest((current) => ({
          ...current,
          symbol: preferredSymbol,
          benchmark_symbol: preferredBenchmark
        }));
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load symbols.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!request.symbol) return;
    let mounted = true;
    setError(null);

    stockDataClient
      .getWeeklyPrices(request.symbol)
      .then((prices) => {
        if (!mounted) return;
        const range = getDateRangeFromWeeklyPrices(request.symbol, prices);
        if (!range) {
          throw new Error(`No adjusted weekly prices found for ${request.symbol.toUpperCase()}.`);
        }
        setDateRange(range);
        setRequest((current) => ({
          ...current,
          start_date: fiveYearsBefore(range.max_date, range.min_date),
          end_date: range.max_date
        }));
        setResult(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setDateRange(null);
        setResult(null);
        setError(err instanceof Error ? err.message : "Unable to load symbol date range.");
      });

    return () => {
      mounted = false;
    };
  }, [request.symbol]);

  const canRun = useMemo(
    () => Boolean(request.symbol && request.benchmark_symbol && request.start_date && request.end_date),
    [request]
  );

  const navigate = (nextRoute: Route) => {
    setSelectedPhoto(null);
    setProjectsOpen(false);
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  };

  const handleRun = async () => {
    if (!canRun || activeStrategy !== "bollinger") return;
    setIsLoading(true);
    setError(null);

    try {
      const nextResult = await runBollingerVsBenchmark(request, stockDataClient);
      setResult(nextResult);
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Backtest failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const markImageMissing = (src: string) => {
    setMissingImages((current) => new Set(current).add(src));
  };

  return (
    <>
      <header className="site-nav">
        <button className="brand-button" type="button" onClick={() => navigate("home")}>
          Alan Jackson
        </button>
        <nav className="nav-links" aria-label="Primary navigation">
          <button className={route === "home" ? "active" : ""} type="button" onClick={() => navigate("home")}>
            <House size={15} aria-hidden="true" />
            Home
          </button>
          <div className={`projects-menu${projectsOpen ? " open" : ""}`}>
            <button
              className={`projects-trigger${["trading", "project-2", "project-3"].includes(route) ? " active" : ""}`}
              type="button"
              aria-expanded={projectsOpen}
              aria-haspopup="true"
              onClick={() => setProjectsOpen((current) => !current)}
            >
              Projects
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {projectsOpen && (
              <div className="projects-dropdown">
                <button type="button" onClick={() => navigate("trading")}>
                  Featured Project: Trading Strategy Visualizer
                </button>
                <button type="button" onClick={() => navigate("project-2")}>
                  Project 2
                </button>
                <button type="button" onClick={() => navigate("project-3")}>
                  Project 3
                </button>
              </div>
            )}
          </div>
          {routes.slice(4).map((navRoute) => (
            <button
              key={navRoute.id}
              className={route === navRoute.id ? "active" : ""}
              type="button"
              onClick={() => navigate(navRoute.id)}
            >
              {navRoute.label}
            </button>
          ))}
        </nav>
      </header>

      {route === "home" && <HomePage onNavigate={navigate} />}
      {route === "trading" && (
        <TradingPage
          activeStrategy={activeStrategy}
          canRun={canRun}
          dateRange={dateRange}
          error={error}
          isLoading={isLoading}
          request={request}
          result={result}
          symbols={symbols}
          onRequestChange={setRequest}
          onRun={handleRun}
          onStrategyChange={setActiveStrategy}
        />
      )}
      {route === "resume" && <ResumePage />}
      {route === "project-2" && <ProjectPlaceholderPage title="Project 2" />}
      {route === "project-3" && <ProjectPlaceholderPage title="Project 3" />}
      {route === "about" && <AboutPage />}
      {route === "contact" && <ContactPage />}
      {route === "photography" && (
        <PhotographyPage
          missingImages={missingImages}
          onImageError={markImageMissing}
          onSelectPhoto={setSelectedPhoto}
        />
      )}

      {selectedPhoto && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={selectedPhoto.label}>
          <button className="lightbox-backdrop" type="button" onClick={() => setSelectedPhoto(null)} />
          <div className="lightbox-content">
            <button className="lightbox-close" type="button" onClick={() => setSelectedPhoto(null)}>
              Close
            </button>
            {missingImages.has(selectedPhoto.src) ? (
              <div className="photo-placeholder large">{selectedPhoto.label}</div>
            ) : (
              <img src={selectedPhoto.src} alt={selectedPhoto.label} onError={() => markImageMissing(selectedPhoto.src)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

type HomePageProps = {
  onNavigate: (route: Route) => void;
};

function HomePage({ onNavigate }: HomePageProps) {
  return (
    <main className="home-page">
      <section
        className="home-hero"
        style={{ "--home-background-image": `url("${publicAssetPath("images/home/background.jpg")}")` } as CSSProperties}
      >
        <div className="home-hero-inner">
          <blockquote className="home-quote">
            <p>
              &ldquo;The most important decision we make is whether we believe we live in a friendly or hostile
              universe.&rdquo;
            </p>
            <cite>&mdash; Albert Einstein</cite>
          </blockquote>
          <button className="primary-cta" type="button" onClick={() => onNavigate("trading")}>
            Featured Project: Trading Strategy Visualizer
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="home-link-band" aria-label="Site sections">
        <button type="button" onClick={() => onNavigate("resume")}>
          Resume
        </button>
        <button type="button" onClick={() => onNavigate("about")}>
          <UserRound size={17} aria-hidden="true" />
          About Me
        </button>
        <button type="button" onClick={() => onNavigate("photography")}>
          <Camera size={17} aria-hidden="true" />
          Photography
        </button>
        <button type="button" onClick={() => onNavigate("contact")}>
          <Mail size={17} aria-hidden="true" />
          Contact
        </button>
      </section>
    </main>
  );
}

type TradingPageProps = {
  activeStrategy: StrategyId;
  canRun: boolean;
  dateRange: DateRange | null;
  error: string | null;
  isLoading: boolean;
  request: BacktestRequest;
  result: BacktestResponse | null;
  symbols: string[];
  onRequestChange: (request: BacktestRequest) => void;
  onRun: () => void;
  onStrategyChange: (strategy: StrategyId) => void;
};

function TradingPage({
  activeStrategy,
  dateRange,
  error,
  isLoading,
  request,
  result,
  symbols,
  onRequestChange,
  onRun,
  onStrategyChange
}: TradingPageProps) {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-copy">
          <p className="eyebrow">
            {appConfig.features.fullTickerUniverse ? "Full weekly price universe" : "Demo static weekly prices"}
          </p>
          <StrategyTabs
            activeStrategy={activeStrategy}
            benchmarkSymbol={request.benchmark_symbol}
            onStrategyChange={onStrategyChange}
          />
        </div>
        <div className="status-pill">{appConfig.appVariant === "demo_static" ? "GitHub Pages demo" : "Local-only"}</div>
      </header>

      <div className="dashboard-layout">
        {activeStrategy === "bollinger" ? (
          <ControlsPanel
            symbols={symbols}
            dateRange={dateRange}
            request={request}
            isLoading={isLoading}
            onRequestChange={onRequestChange}
            onRun={onRun}
          />
        ) : (
          <section className="controls-panel placeholder-panel" aria-label="Strategy controls placeholder">
            <h2>{strategyLabels[activeStrategy]}</h2>
            <p>Controls for this strategy will be added here.</p>
            <div className="placeholder-benchmark">Benchmark: {request.benchmark_symbol || "SPY"} buy-and-hold</div>
          </section>
        )}

        <section className="results-panel">
          {error && <div className="error-banner">{error}</div>}

          {activeStrategy !== "bollinger" && (
            <div className="empty-state">
              <h2>{strategyLabels[activeStrategy]} strategy placeholder</h2>
              <p>Benchmark comparison remains set to {request.benchmark_symbol || "SPY"} buy-and-hold.</p>
            </div>
          )}

          {activeStrategy === "bollinger" && !result && !error && (
            <div className="empty-state">
              <h2>Ready for a backtest</h2>
              <p>Select a symbol and date window, then run the comparison.</p>
            </div>
          )}

          {activeStrategy === "bollinger" && result && (
            <>
              <SummaryCards data={result} />
              <PriceChart data={result} />
              <EquityCurveChart data={result} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ResumePage() {
  return (
    <main className="content-page">
      <section className="content-panel">
        <p className="eyebrow">Resume</p>
        <h1>Alan Jackson</h1>
        <div className="resume-list">
          <article>
            <span>Experience</span>
            <strong>Role / Company / Dates</strong>
          </article>
          <article>
            <span>Projects</span>
            <strong>Trading analytics, portfolio tools, data products</strong>
          </article>
          <article>
            <span>Skills</span>
            <strong>Strategy analysis, data workflows, product thinking</strong>
          </article>
        </div>
      </section>
    </main>
  );
}

type ProjectPlaceholderPageProps = {
  title: string;
};

function ProjectPlaceholderPage({ title }: ProjectPlaceholderPageProps) {
  return (
    <main className="content-page">
      <section className="content-panel narrow">
        <p className="eyebrow">Projects</p>
        <h1>{title}</h1>
        <p>This project placeholder is ready for a future write-up, demo, or case study.</p>
      </section>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="content-page">
      <section className="content-panel narrow">
        <p className="eyebrow">About Me</p>
        <h1>Builder, analyst, photographer.</h1>
        <p>
          This space can introduce your professional background, creative work, and the way you approach
          trading research, software, and visual storytelling.
        </p>
      </section>
    </main>
  );
}

function ContactPage() {
  return (
    <main className="content-page">
      <section className="content-panel narrow">
        <p className="eyebrow">Contact</p>
        <h1>Let&apos;s connect.</h1>
        <p>
          Find me{" "}
          <a href="https://www.linkedin.com/in/alan-jackson-814151b3/" target="_blank" rel="noreferrer">
            <strong>
              <em>here</em>
            </strong>
          </a>{" "}
          on LinkedIn!
        </p>
        <p>You can also reach out to me directly at: aj96818@gmail.com</p>
      </section>
    </main>
  );
}

type PhotographyPageProps = {
  missingImages: Set<string>;
  onImageError: (src: string) => void;
  onSelectPhoto: (photo: PortfolioImage) => void;
};

function PhotographyPage({ missingImages, onImageError, onSelectPhoto }: PhotographyPageProps) {
  return (
    <main className="content-page portfolio-page">
      <section className="content-panel">
        <p className="eyebrow">Photography</p>
        <h1>Portfolio</h1>
        <div className="photo-grid">
          {portfolioImages.map((photo) => (
            <button className="photo-tile" key={photo.src} type="button" onClick={() => onSelectPhoto(photo)}>
              {missingImages.has(photo.src) ? (
                <div className="photo-placeholder">{photo.label}</div>
              ) : (
                <img src={photo.src} alt={photo.label} onError={() => onImageError(photo.src)} />
              )}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
