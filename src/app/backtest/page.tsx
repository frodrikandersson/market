import {
  Activity,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Target,
  DollarSign,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { backtestData } from '@/services/backtest-data';

export const dynamic = 'force-dynamic';

export default async function BacktestPage() {
  const results = await backtestData.getBacktestResults(90);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-display font-bold text-gradient">MARKET PREDICTOR</h1>
            </div>
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-text-secondary hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link
                href="/sectors"
                className="text-text-secondary hover:text-primary transition-colors"
              >
                Sectors
              </Link>
              <Link
                href="/performance"
                className="text-text-secondary hover:text-primary transition-colors"
              >
                Performance
              </Link>
              <Link href="/backtest" className="text-text-primary hover:text-primary transition-colors">
                Backtest
              </Link>
            </nav>
          </div>
        </div>
      </header>

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
          <h1 className="text-3xl font-bold text-text-primary mb-2">Backtest Simulator</h1>
          <p className="text-text-secondary">
            Historical performance simulation - what would have happened following our predictions
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {results.period.start.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              -{' '}
              {results.period.end.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span>{results.period.tradingDays} trading days</span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-negative flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-negative mb-1">Important Disclaimer</p>
            <p className="text-text-secondary">
              This is a hypothetical backtest using historical data. Past performance does not
              guarantee future results. This simulation does not account for transaction costs,
              slippage, or market impact. Do not make investment decisions based on this data.
            </p>
          </div>
        </div>

        {/* Model Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ModelCard
            title="Fundamentals Model"
            data={results.fundamentals}
            color="primary"
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <ModelCard
            title="Hype Model"
            data={results.hype}
            color="secondary"
            icon={<Activity className="w-5 h-5" />}
          />
          <ModelCard
            title="Combined Strategy"
            data={results.combined}
            color="neutral"
            icon={<Target className="w-5 h-5" />}
            description="Only trades when both models agree"
          />
        </div>

        {/* Benchmark Comparison */}
        <div className="bg-surface rounded-lg border border-border p-6 mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Benchmark Comparison</h2>
          <p className="text-sm text-text-muted mb-4">
            Average market return during the period (buy and hold strategy)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded p-4">
              <div className="text-text-muted text-xs mb-1">Market Average</div>
              <div
                className={`text-2xl font-bold font-mono-numbers ${
                  results.benchmark.return >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {results.benchmark.return >= 0 ? '+' : ''}
                {results.benchmark.return.toFixed(2)}%
              </div>
            </div>
            <div className="bg-background rounded p-4">
              <div className="text-text-muted text-xs mb-1">Fundamentals Alpha</div>
              <div
                className={`text-2xl font-bold font-mono-numbers ${
                  results.fundamentals.totalReturn - results.benchmark.return >= 0
                    ? 'text-positive'
                    : 'text-negative'
                }`}
              >
                {results.fundamentals.totalReturn - results.benchmark.return >= 0 ? '+' : ''}
                {(results.fundamentals.totalReturn - results.benchmark.return).toFixed(2)}%
              </div>
            </div>
            <div className="bg-background rounded p-4">
              <div className="text-text-muted text-xs mb-1">Hype Alpha</div>
              <div
                className={`text-2xl font-bold font-mono-numbers ${
                  results.hype.totalReturn - results.benchmark.return >= 0
                    ? 'text-positive'
                    : 'text-negative'
                }`}
              >
                {results.hype.totalReturn - results.benchmark.return >= 0 ? '+' : ''}
                {(results.hype.totalReturn - results.benchmark.return).toFixed(2)}%
              </div>
            </div>
            <div className="bg-background rounded p-4">
              <div className="text-text-muted text-xs mb-1">Total Trades</div>
              <div className="text-2xl font-bold font-mono-numbers text-text-primary">
                {results.benchmark.trades}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Returns */}
        <div className="bg-surface rounded-lg border border-border p-6 mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Monthly Returns</h2>
          {results.monthlyReturns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="pb-3 font-medium">Month</th>
                    <th className="pb-3 font-medium text-right">Fundamentals</th>
                    <th className="pb-3 font-medium text-right">Hype</th>
                    <th className="pb-3 font-medium text-right">Combined</th>
                  </tr>
                </thead>
                <tbody>
                  {results.monthlyReturns.map((month) => (
                    <tr key={month.month} className="border-b border-border/50">
                      <td className="py-3 font-mono-numbers">{month.month}</td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-mono-numbers ${
                            month.fundamentals >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {month.fundamentals >= 0 ? '+' : ''}
                          {month.fundamentals.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-mono-numbers ${
                            month.hype >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {month.hype >= 0 ? '+' : ''}
                          {month.hype.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`font-mono-numbers ${
                            month.combined >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {month.combined >= 0 ? '+' : ''}
                          {month.combined.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-sm">No monthly data available</p>
          )}
        </div>

        {/* Performance by Confidence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Returns by Confidence</h2>
            <p className="text-xs text-text-muted mb-4">
              Higher confidence predictions should yield better returns
            </p>
            <div className="space-y-4">
              {results.byConfidence.map((bucket) => (
                <div key={bucket.bucket} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">{bucket.bucket}</span>
                    <div className="flex gap-4">
                      <span
                        className={`font-mono-numbers ${
                          bucket.fundamentals.return >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        F: {bucket.fundamentals.return >= 0 ? '+' : ''}
                        {bucket.fundamentals.return.toFixed(2)}%
                      </span>
                      <span
                        className={`font-mono-numbers ${
                          bucket.hype.return >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        H: {bucket.hype.return >= 0 ? '+' : ''}
                        {bucket.hype.return.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-text-muted flex gap-4">
                    <span>F: {bucket.fundamentals.trades} trades</span>
                    <span>H: {bucket.hype.trades} trades</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Returns by Sector</h2>
            {results.bySector.length > 0 ? (
              <div className="space-y-4">
                {results.bySector.slice(0, 6).map((sector) => (
                  <div key={sector.sector} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">{sector.sector}</span>
                      <div className="flex gap-4">
                        <span
                          className={`font-mono-numbers ${
                            sector.fundamentals.return >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          F: {sector.fundamentals.return >= 0 ? '+' : ''}
                          {sector.fundamentals.return.toFixed(2)}%
                        </span>
                        <span
                          className={`font-mono-numbers ${
                            sector.hype.return >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          H: {sector.hype.return >= 0 ? '+' : ''}
                          {sector.hype.return.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-text-muted flex gap-4">
                      <span>F: {sector.fundamentals.trades} trades</span>
                      <span>H: {sector.hype.trades} trades</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No sector data available</p>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>Disclaimer:</strong> This is not financial advice. All backtesting results are
            hypothetical and do not represent actual trading. Past performance does not guarantee
            future results. This simulation assumes perfect execution with no slippage, fees, or
            market impact.
          </p>
        </div>
      </div>
    </main>
  );
}

// Model Card Component
function ModelCard({
  title,
  data,
  color,
  icon,
  description,
}: {
  title: string;
  data: {
    totalReturn: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  color: 'primary' | 'secondary' | 'neutral';
  icon: React.ReactNode;
  description?: string;
}) {
  const colorClasses = {
    primary: 'text-primary border-primary/30',
    secondary: 'text-secondary border-secondary/30',
    neutral: 'text-neutral border-neutral/30',
  };

  return (
    <div className={`bg-surface rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={colorClasses[color]}>{icon}</span>
        <h3 className="font-semibold text-text-primary">{title}</h3>
      </div>
      {description && <p className="text-xs text-text-muted mb-4">{description}</p>}

      {/* Total Return */}
      <div className="mb-4">
        <div
          className={`text-4xl font-bold font-mono-numbers ${
            data.totalReturn >= 0 ? 'text-positive' : 'text-negative'
          }`}
        >
          {data.totalReturn >= 0 ? '+' : ''}
          {data.totalReturn.toFixed(2)}%
        </div>
        <div className="text-xs text-text-muted">Total Return</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-text-muted text-xs">Win Rate</div>
          <div className="font-mono-numbers text-text-primary">{data.winRate.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Total Trades</div>
          <div className="font-mono-numbers text-text-primary">{data.totalTrades}</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Winning</div>
          <div className="font-mono-numbers text-positive">{data.winningTrades}</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Losing</div>
          <div className="font-mono-numbers text-negative">{data.losingTrades}</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Avg Win</div>
          <div className="font-mono-numbers text-positive">+{data.avgWin.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Avg Loss</div>
          <div className="font-mono-numbers text-negative">-{data.avgLoss.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Max Drawdown</div>
          <div className="font-mono-numbers text-negative">-{data.maxDrawdown.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-text-muted text-xs">Sharpe Ratio</div>
          <div className="font-mono-numbers text-text-primary">{data.sharpeRatio.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
