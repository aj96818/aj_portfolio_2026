import { Activity, BarChart3, LineChart, Waves } from "lucide-react";

export type StrategyId = "bollinger" | "moving-average" | "rsi" | "momentum";

type StrategyTabsProps = {
  activeStrategy: StrategyId;
  benchmarkSymbol: string;
  onStrategyChange: (strategy: StrategyId) => void;
};

const strategies = [
  { id: "bollinger", label: "Bollinger", icon: Waves },
  { id: "moving-average", label: "Moving Average", icon: LineChart },
  { id: "rsi", label: "RSI", icon: Activity },
  { id: "momentum", label: "Momentum", icon: BarChart3 }
] satisfies { id: StrategyId; label: string; icon: typeof Waves }[];

export const strategyLabels = strategies.reduce(
  (labels, strategy) => ({ ...labels, [strategy.id]: strategy.label }),
  {} as Record<StrategyId, string>
);

const isImplemented = (strategy: StrategyId) => strategy === "bollinger";

export function StrategyTabs({ activeStrategy, benchmarkSymbol, onStrategyChange }: StrategyTabsProps) {
  const activeLabel = strategyLabels[activeStrategy];

  return (
    <section className="strategy-tabs" aria-label="Strategy selector">
      <div className="strategy-tabs-label">
        <span>Strategies</span>
        <strong>
          {activeLabel} vs {benchmarkSymbol || "Benchmark"} buy-and-hold
        </strong>
      </div>

      <div className="strategy-button-row">
        {strategies.map(({ id, label, icon: Icon }) => {
          const isActive = id === activeStrategy;

          return (
            <button
              key={id}
              className={`strategy-button${isActive ? " active" : ""}`}
              type="button"
              aria-pressed={isActive}
              onClick={() => onStrategyChange(id)}
              title={isImplemented(id) ? `${label} strategy` : `${label} strategy placeholder`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
