import { Activity, BarChart3, TrendingUp, Award, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { performanceData } from '@/services/performance-data';
import { AccuracyChart, CalibrationChart, ModelComparisonChart } from '@/components/AccuracyChart';
import { Header } from '@/components/Header';
import { RecentPredictionsTable } from '@/components/RecentPredictionsTable';

export const dynamic = 'force-dynamic';

export default async function PerformancePage() {
  const data = await performanceData.getPerformanceData();

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
          {/* Accuracy Over Time - Line Chart */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <AccuracyChart
              data={data.accuracyOverTime}
              title="Accuracy Over Time"
              showArea={true}
            />
          </div>

          {/* Confidence Calibration - Line Chart */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <CalibrationChart
              data={data.accuracyByConfidence.map((bucket) => ({
                bucket: bucket.bucket,
                expectedAccuracy: (bucket.range[0] + bucket.range[1]) / 2 * 100,
                fundamentalsAccuracy: bucket.fundamentals.accuracy,
                hypeAccuracy: bucket.hype.accuracy,
                fundamentalsCount: bucket.fundamentals.total,
                hypeCount: bucket.hype.total,
              }))}
            />
          </div>
        </div>

        {/* Model Showdown */}
        <div className="bg-surface rounded-lg border border-border p-6 mb-8">
          <ModelComparisonChart
            fundamentalsWins={data.modelShowdown.fundamentalsWins}
            hypeWins={data.modelShowdown.hypeWins}
            ties={data.modelShowdown.ties}
          />
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
        <RecentPredictionsTable />

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
