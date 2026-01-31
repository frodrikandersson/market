import { ArrowLeft, TrendingUp, TrendingDown, Building2, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { sectorData } from '@/services/sector-data';
import { Header } from '@/components/Header';

export const dynamic = 'force-dynamic';

export default async function SectorsPage() {
  const sectors = await sectorData.getSectorOverview();

  return (
    <main className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Sector Heat Map</h1>
          <p className="text-text-secondary">
            Market sentiment and predictions organized by sector
          </p>
        </div>

        {/* Sector Grid */}
        {sectors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sectors.map((sector) => (
              <SectorCard key={sector.sector} sector={sector} />
            ))}
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-border p-12 text-center">
            <Building2 className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">No Sector Data</h2>
            <p className="text-text-secondary">
              Sector data will appear once companies are added and predictions are generated.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 bg-surface rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Heat Map Legend</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-positive/60" />
              <span className="text-text-secondary">Positive Sentiment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-neutral/60" />
              <span className="text-text-secondary">Neutral Sentiment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-negative/60" />
              <span className="text-text-secondary">Negative Sentiment</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>Disclaimer:</strong> This is not financial advice. Predictions are for
            educational and entertainment purposes only. Past performance does not guarantee future
            results.
          </p>
        </div>
      </div>
    </main>
  );
}

// Sector Card Component
function SectorCard({
  sector,
}: {
  sector: {
    sector: string;
    companyCount: number;
    sentiment: {
      positive: number;
      negative: number;
      neutral: number;
      overall: 'positive' | 'negative' | 'neutral';
      score: number;
    };
    predictions: {
      up: number;
      down: number;
      fundamentalsAccuracy: number;
      hypeAccuracy: number;
    };
    topMovers: {
      ticker: string;
      name: string;
      prediction: 'up' | 'down';
      confidence: number;
    }[];
    recentNews: number;
  };
}) {
  const sentimentColor =
    sector.sentiment.overall === 'positive'
      ? 'border-positive/50 bg-positive/5'
      : sector.sentiment.overall === 'negative'
        ? 'border-negative/50 bg-negative/5'
        : 'border-neutral/50 bg-neutral/5';

  const sentimentGlow =
    sector.sentiment.overall === 'positive'
      ? 'hover:shadow-[0_0_20px_rgba(0,255,136,0.2)]'
      : sector.sentiment.overall === 'negative'
        ? 'hover:shadow-[0_0_20px_rgba(255,51,102,0.2)]'
        : 'hover:shadow-[0_0_20px_rgba(139,139,154,0.2)]';

  return (
    <div
      className={`bg-surface rounded-lg border p-6 transition-all duration-300 ${sentimentColor} ${sentimentGlow}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{sector.sector}</h2>
          <p className="text-sm text-text-muted">{sector.companyCount} companies</p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            sector.sentiment.overall === 'positive'
              ? 'bg-positive/20 text-positive'
              : sector.sentiment.overall === 'negative'
                ? 'bg-negative/20 text-negative'
                : 'bg-neutral/20 text-neutral'
          }`}
        >
          {sector.sentiment.overall === 'positive' && '▲'}
          {sector.sentiment.overall === 'negative' && '▼'}
          {sector.sentiment.overall === 'neutral' && '◆'}
          {' '}
          {sector.sentiment.overall.charAt(0).toUpperCase() + sector.sentiment.overall.slice(1)}
        </div>
      </div>

      {/* Sentiment Bar */}
      <div className="mb-4">
        <div className="text-xs text-text-muted mb-1">Sentiment Distribution</div>
        <div className="h-2 flex rounded-full overflow-hidden bg-background">
          {sector.sentiment.positive > 0 && (
            <div
              className="bg-positive"
              style={{
                width: `${(sector.sentiment.positive / (sector.sentiment.positive + sector.sentiment.negative + sector.sentiment.neutral)) * 100}%`,
              }}
            />
          )}
          {sector.sentiment.neutral > 0 && (
            <div
              className="bg-neutral"
              style={{
                width: `${(sector.sentiment.neutral / (sector.sentiment.positive + sector.sentiment.negative + sector.sentiment.neutral)) * 100}%`,
              }}
            />
          )}
          {sector.sentiment.negative > 0 && (
            <div
              className="bg-negative"
              style={{
                width: `${(sector.sentiment.negative / (sector.sentiment.positive + sector.sentiment.negative + sector.sentiment.neutral)) * 100}%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span className="text-positive">{sector.sentiment.positive} positive</span>
          <span className="text-negative">{sector.sentiment.negative} negative</span>
        </div>
      </div>

      {/* Predictions Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-background rounded p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-positive" />
            <span className="text-sm text-text-secondary">Bullish</span>
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-positive">
            {sector.predictions.up}
          </div>
        </div>
        <div className="bg-background rounded p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-negative" />
            <span className="text-sm text-text-secondary">Bearish</span>
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-negative">
            {sector.predictions.down}
          </div>
        </div>
      </div>

      {/* Model Accuracy */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Fundamentals
          </span>
          <span className="font-mono-numbers text-primary">
            {sector.predictions.fundamentalsAccuracy.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${sector.predictions.fundamentalsAccuracy}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Hype Model</span>
          <span className="font-mono-numbers text-secondary">
            {sector.predictions.hypeAccuracy.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full"
            style={{ width: `${sector.predictions.hypeAccuracy}%` }}
          />
        </div>
      </div>

      {/* Top Movers */}
      {sector.topMovers.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="text-xs text-text-muted mb-2">Top Predictions</div>
          <div className="space-y-2">
            {sector.topMovers.map((mover) => (
              <Link
                key={mover.ticker}
                href={`/stock/${mover.ticker}`}
                className="flex items-center justify-between p-2 bg-background rounded hover:bg-background/80 transition-colors"
              >
                <div>
                  <span className="font-semibold text-text-primary">{mover.ticker}</span>
                  <span className="text-xs text-text-muted ml-2 truncate">{mover.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${
                      mover.prediction === 'up' ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {mover.prediction === 'up' ? '▲' : '▼'}
                  </span>
                  <span className="text-xs font-mono-numbers text-text-secondary">
                    {(mover.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* News Count */}
      <div className="mt-4 pt-4 border-t border-border text-xs text-text-muted">
        {sector.recentNews} news items in the last 30 days
      </div>
    </div>
  );
}
