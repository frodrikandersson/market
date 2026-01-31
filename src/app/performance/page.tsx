import { Activity, BarChart3, TrendingUp, Award, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { performanceData } from '@/services/performance-data';

export const dynamic = 'force-dynamic';

export default async function PerformancePage() {
  const data = await performanceData.getPerformanceData();

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
              <Link href="/performance" className="text-text-primary hover:text-primary transition-colors">
                Performance
              </Link>
              <Link
                href="/backtest"
                className="text-text-secondary hover:text-primary transition-colors"
              >
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
          <h1 className="text-3xl font-bold text-text-primary mb-2">Model Performance</h1>
          <p className="text-text-secondary">
            Compare accuracy and track prediction history for both models
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Fundamentals Accuracy"
            value={`${data.overall.fundamentals.accuracy.toFixed(1)}%`}
            subtext={`${data.overall.fundamentals.correct}/${data.overall.fundamentals.total} correct`}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <StatCard
            label="Hype Model Accuracy"
            value={`${data.overall.hype.accuracy.toFixed(1)}%`}
            subtext={`${data.overall.hype.correct}/${data.overall.hype.total} correct`}
            icon={<Activity className="w-5 h-5" />}
            variant="secondary"
          />
          <StatCard
            label="Fundamentals Streak"
            value={data.streaks.fundamentalsCurrentStreak.toString()}
            subtext={`Best: ${data.streaks.fundamentalsBestStreak}`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Hype Streak"
            value={data.streaks.hypeCurrentStreak.toString()}
            subtext={`Best: ${data.streaks.hypeBestStreak}`}
            icon={<Award className="w-5 h-5" />}
            variant="secondary"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Accuracy Over Time */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Accuracy Over Time</h2>
            {data.accuracyOverTime.length > 0 ? (
              <div className="space-y-2">
                {data.accuracyOverTime.slice(-10).map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <span className="text-xs text-text-muted w-20 font-mono-numbers">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-4 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${day.fundamentals}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono-numbers text-primary w-12">
                        {day.fundamentals}%
                      </span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-4 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full"
                          style={{ width: `${day.hype}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono-numbers text-secondary w-12">
                        {day.hype}%
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                  <span className="text-xs text-text-muted w-20">Legend:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded" />
                    <span className="text-xs text-text-secondary">Fundamentals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-secondary rounded" />
                    <span className="text-xs text-text-secondary">Hype</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm">No prediction history yet</p>
            )}
          </div>

          {/* Accuracy by Confidence */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Accuracy by Confidence</h2>
            <p className="text-xs text-text-muted mb-4">
              Higher confidence should mean higher accuracy (calibration)
            </p>
            <div className="space-y-4">
              {data.accuracyByConfidence.map((bucket) => (
                <div key={bucket.bucket} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">{bucket.bucket}</span>
                    <div className="flex gap-4">
                      <span className="text-primary font-mono-numbers">
                        F: {bucket.fundamentals.accuracy.toFixed(0)}%
                        <span className="text-text-muted text-xs ml-1">
                          ({bucket.fundamentals.total})
                        </span>
                      </span>
                      <span className="text-secondary font-mono-numbers">
                        H: {bucket.hype.accuracy.toFixed(0)}%
                        <span className="text-text-muted text-xs ml-1">({bucket.hype.total})</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${bucket.fundamentals.accuracy}%` }}
                      />
                    </div>
                    <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full"
                        style={{ width: `${bucket.hype.accuracy}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Accuracy by Sector */}
        <div className="bg-surface rounded-lg border border-border p-6 mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Accuracy by Sector</h2>
          {data.accuracyBySector.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.accuracyBySector.map((sector) => (
                <div key={sector.sector} className="bg-background rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">{sector.sector}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted">Fundamentals</span>
                      <span className="text-sm font-mono-numbers text-primary">
                        {sector.fundamentals.accuracy.toFixed(1)}%
                        <span className="text-text-muted text-xs ml-1">
                          ({sector.fundamentals.total})
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${sector.fundamentals.accuracy}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-text-muted">Hype Model</span>
                      <span className="text-sm font-mono-numbers text-secondary">
                        {sector.hype.accuracy.toFixed(1)}%
                        <span className="text-text-muted text-xs ml-1">({sector.hype.total})</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full"
                        style={{ width: `${sector.hype.accuracy}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm">No sector data available yet</p>
          )}
        </div>

        {/* Recent Predictions */}
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Recent Predictions</h2>
          {data.recentPredictions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Ticker</th>
                    <th className="pb-3 font-medium">Model</th>
                    <th className="pb-3 font-medium">Predicted</th>
                    <th className="pb-3 font-medium">Actual</th>
                    <th className="pb-3 font-medium">Confidence</th>
                    <th className="pb-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPredictions.map((pred) => (
                    <tr key={pred.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="py-3 font-mono-numbers text-text-secondary">
                        {pred.targetDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3">
                        <span className="font-semibold text-text-primary">{pred.ticker}</span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            pred.modelType === 'fundamentals'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-secondary/20 text-secondary'
                          }`}
                        >
                          {pred.modelType === 'fundamentals' ? 'Fund' : 'Hype'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={
                            pred.predictedDirection === 'up' ? 'text-positive' : 'text-negative'
                          }
                        >
                          {pred.predictedDirection === 'up' ? '▲ UP' : '▼ DOWN'}
                        </span>
                      </td>
                      <td className="py-3">
                        {pred.actualDirection ? (
                          <span
                            className={
                              pred.actualDirection === 'up' ? 'text-positive' : 'text-negative'
                            }
                          >
                            {pred.actualDirection === 'up' ? '▲ UP' : '▼ DOWN'}
                            {pred.actualChange !== null && (
                              <span className="text-text-muted text-xs ml-1">
                                ({pred.actualChange > 0 ? '+' : ''}
                                {pred.actualChange.toFixed(2)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-text-muted">Pending</span>
                        )}
                      </td>
                      <td className="py-3 font-mono-numbers text-text-secondary">
                        {(pred.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="py-3">
                        {pred.wasCorrect !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              pred.wasCorrect
                                ? 'bg-positive/20 text-positive'
                                : 'bg-negative/20 text-negative'
                            }`}
                          >
                            {pred.wasCorrect ? 'Correct' : 'Wrong'}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-sm">No predictions yet</p>
          )}
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

// Components
function StatCard({
  label,
  value,
  subtext,
  icon,
  variant = 'primary',
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-6 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-sm uppercase tracking-wider">{label}</span>
        <span className={variant === 'secondary' ? 'text-secondary' : 'text-primary'}>{icon}</span>
      </div>
      <div
        className={`text-3xl font-bold font-mono-numbers ${
          variant === 'secondary' ? 'text-secondary' : 'text-primary'
        }`}
      >
        {value}
      </div>
      <div className="text-sm text-text-muted mt-1">{subtext}</div>
    </div>
  );
}
