import { TrendingUp, Activity, BarChart3, RefreshCw } from 'lucide-react';
import { dashboardData } from '@/services/dashboard-data';
import { RefreshButton } from '@/components/RefreshButton';
import { RedditSentimentMeter } from '@/components/RedditSentimentMeter';
import type { Sentiment } from '@/types';

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch real data from database
  const data = await dashboardData.getDashboardData();

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
              <a
                href="/sectors"
                className="text-text-secondary hover:text-primary transition-colors"
              >
                Sectors
              </a>
              <a
                href="/performance"
                className="text-text-secondary hover:text-primary transition-colors"
              >
                Performance
              </a>
              <a
                href="/backtest"
                className="text-text-secondary hover:text-primary transition-colors"
              >
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
            value={`${data.stats.fundamentalsAccuracy.toFixed(1)}%`}
            trend={+2.1}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <StatCard
            label="Hype Model Accuracy"
            value={`${data.stats.hypeAccuracy.toFixed(1)}%`}
            trend={-1.3}
            icon={<Activity className="w-5 h-5" />}
            variant="secondary"
          />
          <StatCard
            label="Articles Processed"
            value={data.stats.articlesProcessed.toLocaleString()}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Events Today"
            value={data.stats.eventsToday.toString()}
            icon={<RefreshCw className="w-5 h-5" />}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Predictions Grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-text-primary">
                Companies with Recent News
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-xs text-text-muted">
                  Updated: {data.lastUpdated.toISOString().slice(0, 16).replace('T', ' ')} UTC
                </div>
                <RefreshButton />
              </div>
            </div>

            {data.predictions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.predictions.map((prediction) => (
                  <StockCard key={prediction.ticker} {...prediction} />
                ))}
              </div>
            ) : (
              <div className="bg-surface rounded-lg border border-border p-8 text-center">
                <p className="text-text-secondary mb-2">No news impacts yet</p>
                <p className="text-text-muted text-sm">
                  Run the news pipeline to populate data:
                </p>
                <code className="text-xs text-primary mt-2 block">
                  npx tsx scripts/run-news-pipeline.ts
                </code>
              </div>
            )}
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
                      {data.stats.fundamentalsAccuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${data.stats.fundamentalsAccuracy}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary">Hype Model</span>
                    <span className="text-secondary font-mono-numbers">
                      {data.stats.hypeAccuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-500"
                      style={{ width: `${data.stats.hypeAccuracy}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-4">
                Based on {data.stats.totalPredictions} total predictions
              </p>
            </div>

            {/* Reddit Sentiment Meter */}
            <RedditSentimentMeter sentiment={data.redditSentiment} />

            {/* Latest News Events */}
            <div className="bg-surface rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Latest News</h3>
              {data.newsEvents.length > 0 ? (
                <div className="space-y-3">
                  {data.newsEvents.map((event) => (
                    <NewsEventItem
                      key={event.id}
                      title={event.title}
                      time={event.timeAgo}
                      sentiment={event.sentiment}
                      tickers={event.affectedTickers}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm">No recent news events</p>
              )}
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
        <div className={`text-sm mt-1 ${trend >= 0 ? 'text-positive' : 'text-negative'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last week
        </div>
      )}
    </div>
  );
}

interface DataSource {
  type: 'news' | 'reddit';
  name: string;
  sentiment: Sentiment;
  count: number;
}

function StockCard({
  ticker,
  name,
  fundamentals,
  hype,
  wasCorrect,
  newsImpactScore,
  sentiment,
  dataSources,
}: {
  ticker: string;
  name: string;
  sector: string | null;
  price: number;
  change: number;
  changePercent: number;
  fundamentals: { direction: 'up' | 'down'; confidence: number } | null;
  hype: { direction: 'up' | 'down'; confidence: number } | null;
  wasCorrect: boolean | null;
  newsImpactScore: number;
  sentiment: Sentiment;
  dataSources: DataSource[];
}) {
  // Determine border color based on sentiment
  const borderClass =
    sentiment === 'positive'
      ? 'border-positive/50 shadow-glow-green'
      : sentiment === 'negative'
        ? 'border-negative/50 shadow-glow-red'
        : 'border-border';

  return (
    <div
      className={`bg-surface rounded-lg border p-4 transition-all duration-200 hover:bg-surface-elevated ${borderClass}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl font-bold font-mono-numbers text-text-primary">{ticker}</h3>
          <p className="text-sm text-text-secondary">{name}</p>
        </div>
        <SentimentBadge sentiment={sentiment} wasCorrect={wasCorrect} />
      </div>

      {/* News Impact Score */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-text-muted text-sm">News Impact:</span>
        <span
          className={`text-lg font-bold font-mono-numbers ${
            newsImpactScore > 0
              ? 'text-positive'
              : newsImpactScore < 0
                ? 'text-negative'
                : 'text-text-secondary'
          }`}
        >
          {newsImpactScore > 0 ? '+' : ''}
          {newsImpactScore.toFixed(2)}
        </span>
      </div>

      {/* Data Sources */}
      {dataSources.length > 0 && (
        <div className="mb-4">
          <span className="text-text-muted text-xs block mb-1.5">SOURCES</span>
          <div className="flex flex-wrap gap-1.5">
            {dataSources.map((source) => (
              <span
                key={source.name}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                  source.sentiment === 'positive'
                    ? 'bg-positive/10 text-positive border border-positive/20'
                    : source.sentiment === 'negative'
                      ? 'bg-negative/10 text-negative border border-negative/20'
                      : 'bg-neutral/10 text-neutral border border-neutral/20'
                }`}
              >
                {source.type === 'reddit' ? '🔴' : '📰'}{' '}
                {source.name}
                {source.count > 1 && (
                  <span className="opacity-70">({source.count})</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dual Model Predictions */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-background/50 rounded p-2 border border-border">
          <span className="text-text-muted text-xs block mb-1">FUNDAMENTALS</span>
          {fundamentals ? (
            <div className="flex items-center gap-1">
              <span
                className={fundamentals.direction === 'up' ? 'text-positive' : 'text-negative'}
              >
                {fundamentals.direction === 'up' ? '▲ UP' : '▼ DOWN'}
              </span>
              <span className="text-text-secondary text-xs">
                ({(fundamentals.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          ) : (
            <span className="text-text-muted text-xs">Pending...</span>
          )}
        </div>
        <div className="bg-secondary/10 rounded p-2 border border-secondary/30">
          <span className="text-secondary text-xs block mb-1">HYPE MODEL</span>
          {hype ? (
            <div className="flex items-center gap-1">
              <span className={hype.direction === 'up' ? 'text-positive' : 'text-negative'}>
                {hype.direction === 'up' ? '▲ UP' : '▼ DOWN'}
              </span>
              <span className="text-text-secondary text-xs">
                ({(hype.confidence * 100).toFixed(0)}%)
              </span>
            </div>
          ) : (
            <span className="text-text-muted text-xs">Pending...</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SentimentBadge({
  sentiment,
  wasCorrect,
}: {
  sentiment: Sentiment;
  wasCorrect: boolean | null;
}) {
  if (wasCorrect !== null) {
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-md ${
          wasCorrect
            ? 'bg-positive/20 text-positive border border-positive/30'
            : 'bg-negative/20 text-negative border border-negative/30'
        }`}
      >
        {wasCorrect ? '✓ CORRECT' : '✗ WRONG'}
      </span>
    );
  }

  const sentimentStyles = {
    positive: 'bg-positive/20 text-positive border border-positive/30',
    negative: 'bg-negative/20 text-negative border border-negative/30',
    neutral: 'bg-neutral/20 text-neutral border border-neutral/30',
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-md ${sentimentStyles[sentiment]}`}>
      {sentiment === 'positive' ? '📈 BULLISH' : sentiment === 'negative' ? '📉 BEARISH' : '➖ NEUTRAL'}
    </span>
  );
}

function NewsEventItem({
  title,
  time,
  sentiment,
  tickers,
}: {
  title: string;
  time: string;
  sentiment: Sentiment;
  tickers: string[];
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
        <p className="text-sm text-text-primary line-clamp-2">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-text-muted">{time}</span>
          {tickers.length > 0 && (
            <span className="text-xs text-primary">{tickers.slice(0, 3).join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
