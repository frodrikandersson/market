import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

// Placeholder data - will be replaced with real data from the database
const mockPredictions = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    price: 182.52,
    change: 2.34,
    changePercent: 1.30,
    fundamentals: { direction: 'up' as const, confidence: 0.78 },
    hype: { direction: 'up' as const, confidence: 0.65 },
    wasCorrect: true,
  },
  {
    ticker: 'TSLA',
    name: 'Tesla, Inc.',
    price: 241.18,
    change: -8.42,
    changePercent: -3.37,
    fundamentals: { direction: 'down' as const, confidence: 0.82 },
    hype: { direction: 'up' as const, confidence: 0.71 },
    wasCorrect: true,
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 487.92,
    change: 12.45,
    changePercent: 2.62,
    fundamentals: { direction: 'up' as const, confidence: 0.91 },
    hype: { direction: 'up' as const, confidence: 0.88 },
    wasCorrect: true,
  },
  {
    ticker: 'META',
    name: 'Meta Platforms',
    price: 374.28,
    change: -2.15,
    changePercent: -0.57,
    fundamentals: { direction: 'up' as const, confidence: 0.55 },
    hype: { direction: 'down' as const, confidence: 0.62 },
    wasCorrect: false,
  },
];

const stats = {
  fundamentalsAccuracy: 67.3,
  hypeAccuracy: 54.2,
  totalPredictions: 1247,
  todayPredictions: 48,
};

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-display font-bold text-gradient">
                MARKET PREDICTOR
              </h1>
            </div>
            <nav className="flex items-center gap-6">
              <a href="/" className="text-text-primary hover:text-primary transition-colors">
                Dashboard
              </a>
              <a href="/sectors" className="text-text-secondary hover:text-primary transition-colors">
                Sectors
              </a>
              <a href="/performance" className="text-text-secondary hover:text-primary transition-colors">
                Performance
              </a>
              <a href="/backtest" className="text-text-secondary hover:text-primary transition-colors">
                Backtest
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Fundamentals Accuracy"
            value={`${stats.fundamentalsAccuracy}%`}
            trend={+2.1}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <StatCard
            label="Hype Model Accuracy"
            value={`${stats.hypeAccuracy}%`}
            trend={-1.3}
            icon={<Activity className="w-5 h-5" />}
            variant="secondary"
          />
          <StatCard
            label="Total Predictions"
            value={stats.totalPredictions.toLocaleString()}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Today's Picks"
            value={stats.todayPredictions.toString()}
            icon={<TrendingDown className="w-5 h-5" />}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Predictions Grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-text-primary">
                Today's Predictions
              </h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-sm bg-primary/20 text-primary rounded-md border border-primary/30 hover:bg-primary/30 transition-colors">
                  All
                </button>
                <button className="px-3 py-1 text-sm bg-surface text-text-secondary rounded-md border border-border hover:border-primary/30 transition-colors">
                  Correct
                </button>
                <button className="px-3 py-1 text-sm bg-surface text-text-secondary rounded-md border border-border hover:border-primary/30 transition-colors">
                  Wrong
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockPredictions.map((prediction) => (
                <StockCard key={prediction.ticker} {...prediction} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Model Comparison */}
            <div className="bg-surface rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Model Comparison
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary">Fundamentals</span>
                    <span className="text-primary font-mono-numbers">
                      {stats.fundamentalsAccuracy}%
                    </span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${stats.fundamentalsAccuracy}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary">Hype Model</span>
                    <span className="text-secondary font-mono-numbers">
                      {stats.hypeAccuracy}%
                    </span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-500"
                      style={{ width: `${stats.hypeAccuracy}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Latest News Events */}
            <div className="bg-surface rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Latest Events
              </h3>
              <div className="space-y-3">
                <NewsEventItem
                  title="Apple Vision Pro sales exceed expectations in Q1"
                  time="2h ago"
                  sentiment="positive"
                />
                <NewsEventItem
                  title="Fed signals potential rate cuts in coming months"
                  time="4h ago"
                  sentiment="neutral"
                />
                <NewsEventItem
                  title="Tesla faces production delays at Berlin factory"
                  time="6h ago"
                  sentiment="negative"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>Disclaimer:</strong> This is not financial advice. Predictions are for
            educational and entertainment purposes only. Past performance does not guarantee
            future results. Do not make investment decisions based on this tool.
          </p>
        </div>
      </div>
    </main>
  );
}

// Components
function StatCard({
  label,
  value,
  trend,
  icon,
  variant = 'primary',
}: {
  label: string;
  value: string;
  trend?: number;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-6 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-sm uppercase tracking-wider">{label}</span>
        <span className={variant === 'secondary' ? 'text-secondary' : 'text-primary'}>
          {icon}
        </span>
      </div>
      <div
        className={`text-3xl font-bold font-mono-numbers ${
          variant === 'secondary' ? 'text-secondary' : 'text-primary'
        }`}
      >
        {value}
      </div>
      {trend !== undefined && (
        <div
          className={`text-sm mt-1 ${trend >= 0 ? 'text-positive' : 'text-negative'}`}
        >
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last week
        </div>
      )}
    </div>
  );
}

function StockCard({
  ticker,
  name,
  price,
  change,
  changePercent,
  fundamentals,
  hype,
  wasCorrect,
}: {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  fundamentals: { direction: 'up' | 'down'; confidence: number };
  hype: { direction: 'up' | 'down'; confidence: number };
  wasCorrect: boolean;
}) {
  return (
    <div
      className={`bg-surface rounded-lg border p-4 transition-all duration-200 hover:bg-surface-elevated ${
        wasCorrect
          ? 'border-positive/50 shadow-glow-green'
          : 'border-negative/50 shadow-glow-red'
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-bold font-mono-numbers text-text-primary">
            {ticker}
          </h3>
          <p className="text-sm text-text-secondary">{name}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded-md ${
            wasCorrect
              ? 'bg-positive/20 text-positive border border-positive/30'
              : 'bg-negative/20 text-negative border border-negative/30'
          }`}
        >
          {wasCorrect ? '✓ CORRECT' : '✗ WRONG'}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold font-mono-numbers text-text-primary">
          ${price.toFixed(2)}
        </span>
        <span
          className={`text-lg font-mono-numbers ${
            changePercent >= 0 ? 'text-positive' : 'text-negative'
          }`}
        >
          {changePercent >= 0 ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
        </span>
      </div>

      {/* Dual Model Predictions */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-background/50 rounded p-2 border border-border">
          <span className="text-text-muted text-xs block mb-1">FUNDAMENTALS</span>
          <div className="flex items-center gap-1">
            <span
              className={
                fundamentals.direction === 'up' ? 'text-positive' : 'text-negative'
              }
            >
              {fundamentals.direction === 'up' ? '▲ UP' : '▼ DOWN'}
            </span>
            <span className="text-text-secondary text-xs">
              ({(fundamentals.confidence * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
        <div className="bg-secondary/10 rounded p-2 border border-secondary/30">
          <span className="text-secondary text-xs block mb-1">HYPE MODEL</span>
          <div className="flex items-center gap-1">
            <span className={hype.direction === 'up' ? 'text-positive' : 'text-negative'}>
              {hype.direction === 'up' ? '▲ UP' : '▼ DOWN'}
            </span>
            <span className="text-text-secondary text-xs">
              ({(hype.confidence * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsEventItem({
  title,
  time,
  sentiment,
}: {
  title: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}) {
  const sentimentColors = {
    positive: 'bg-positive',
    negative: 'bg-negative',
    neutral: 'bg-neutral',
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`w-2 h-2 rounded-full mt-2 ${sentimentColors[sentiment]}`} />
      <div className="flex-1">
        <p className="text-sm text-text-primary">{title}</p>
        <span className="text-xs text-text-muted">{time}</span>
      </div>
    </div>
  );
}
