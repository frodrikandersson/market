import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  BarChart3,
  Newspaper,
  MessageCircle,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { stockData } from '@/services/stock-data';
import { PriceChart } from '@/components/PriceChart';
import { Header } from '@/components/Header';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params;
  const data = await stockData.getStockDetails(ticker.toUpperCase());

  if (!data) {
    notFound();
  }

  const { company, latestPrice, predictions, accuracy, priceHistory, recentNews, recentSocial } =
    data;

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

        {/* Stock Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold font-mono-numbers text-text-primary">
                {company.ticker}
              </h1>
              {company.sector && (
                <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded">
                  {company.sector}
                </span>
              )}
            </div>
            <p className="text-text-secondary text-lg">{company.name}</p>
            {company.marketCap && (
              <p className="text-text-muted text-sm mt-1">
                Market Cap: ${(company.marketCap / 1e9).toFixed(2)}B
              </p>
            )}
          </div>

          {latestPrice && (
            <div className="bg-surface rounded-lg border border-border p-6">
              <div className="text-4xl font-bold font-mono-numbers text-text-primary">
                ${latestPrice.close.toFixed(2)}
              </div>
              <div
                className={`flex items-center gap-2 mt-2 ${
                  latestPrice.changePercent >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {latestPrice.changePercent >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span className="font-mono-numbers text-lg">
                  {latestPrice.changePercent >= 0 ? '+' : ''}
                  {latestPrice.change.toFixed(2)} ({latestPrice.changePercent.toFixed(2)}%)
                </span>
              </div>
              <p className="text-text-muted text-xs mt-2">
                {latestPrice.date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>

        {/* Dual Predictions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Fundamentals Prediction */}
          <div
            className={`bg-surface rounded-lg border p-6 ${
              predictions.fundamentals
                ? predictions.fundamentals.predictedDirection === 'up'
                  ? 'border-positive/50'
                  : 'border-negative/50'
                : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">Fundamentals Model</h2>
              </div>
              {predictions.fundamentals && predictions.fundamentals.wasCorrect !== null && (
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    predictions.fundamentals.wasCorrect
                      ? 'bg-positive/20 text-positive'
                      : 'bg-negative/20 text-negative'
                  }`}
                >
                  {predictions.fundamentals.wasCorrect ? 'Correct' : 'Wrong'}
                </span>
              )}
            </div>

            {predictions.fundamentals ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`text-3xl font-bold ${
                      predictions.fundamentals.predictedDirection === 'up'
                        ? 'text-positive'
                        : 'text-negative'
                    }`}
                  >
                    {predictions.fundamentals.predictedDirection === 'up' ? '▲ UP' : '▼ DOWN'}
                  </div>
                  <div className="text-text-secondary">
                    <span className="font-mono-numbers text-xl">
                      {(predictions.fundamentals.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm ml-1">confidence</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-text-muted">
                    <span>Target Date</span>
                    <span className="font-mono-numbers">
                      {predictions.fundamentals.targetDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {predictions.fundamentals.newsImpactScore !== null && (
                    <div className="flex justify-between text-text-muted">
                      <span>News Impact</span>
                      <span className="font-mono-numbers">
                        {predictions.fundamentals.newsImpactScore.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {predictions.fundamentals.actualChange !== null && (
                    <div className="flex justify-between text-text-muted">
                      <span>Actual Change</span>
                      <span
                        className={`font-mono-numbers ${
                          predictions.fundamentals.actualChange >= 0
                            ? 'text-positive'
                            : 'text-negative'
                        }`}
                      >
                        {predictions.fundamentals.actualChange >= 0 ? '+' : ''}
                        {predictions.fundamentals.actualChange.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-text-muted">No prediction available</p>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-text-muted">Historical Accuracy</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${accuracy.fundamentals.accuracy}%` }}
                  />
                </div>
                <span className="font-mono-numbers text-sm text-primary">
                  {accuracy.fundamentals.accuracy.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-text-muted mt-1">
                {accuracy.fundamentals.correct}/{accuracy.fundamentals.total} correct
              </div>
            </div>
          </div>

          {/* Hype Prediction */}
          <div
            className={`bg-surface rounded-lg border p-6 ${
              predictions.hype
                ? predictions.hype.predictedDirection === 'up'
                  ? 'border-positive/50'
                  : 'border-negative/50'
                : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-secondary" />
                <h2 className="text-lg font-semibold text-text-primary">Hype Model</h2>
              </div>
              {predictions.hype && predictions.hype.wasCorrect !== null && (
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    predictions.hype.wasCorrect
                      ? 'bg-positive/20 text-positive'
                      : 'bg-negative/20 text-negative'
                  }`}
                >
                  {predictions.hype.wasCorrect ? 'Correct' : 'Wrong'}
                </span>
              )}
            </div>

            {predictions.hype ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`text-3xl font-bold ${
                      predictions.hype.predictedDirection === 'up'
                        ? 'text-positive'
                        : 'text-negative'
                    }`}
                  >
                    {predictions.hype.predictedDirection === 'up' ? '▲ UP' : '▼ DOWN'}
                  </div>
                  <div className="text-text-secondary">
                    <span className="font-mono-numbers text-xl">
                      {(predictions.hype.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm ml-1">confidence</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-text-muted">
                    <span>Target Date</span>
                    <span className="font-mono-numbers">
                      {predictions.hype.targetDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {predictions.hype.socialImpactScore !== null && (
                    <div className="flex justify-between text-text-muted">
                      <span>Social Impact</span>
                      <span className="font-mono-numbers">
                        {predictions.hype.socialImpactScore.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {predictions.hype.actualChange !== null && (
                    <div className="flex justify-between text-text-muted">
                      <span>Actual Change</span>
                      <span
                        className={`font-mono-numbers ${
                          predictions.hype.actualChange >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {predictions.hype.actualChange >= 0 ? '+' : ''}
                        {predictions.hype.actualChange.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-text-muted">No prediction available</p>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-text-muted">Historical Accuracy</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full"
                    style={{ width: `${accuracy.hype.accuracy}%` }}
                  />
                </div>
                <span className="font-mono-numbers text-sm text-secondary">
                  {accuracy.hype.accuracy.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-text-muted mt-1">
                {accuracy.hype.correct}/{accuracy.hype.total} correct
              </div>
            </div>
          </div>
        </div>

        {/* Price Chart */}
        <div className="bg-surface rounded-lg border border-border p-6 mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {company.ticker} Price History
          </h2>
          <PriceChart data={priceHistory} ticker={company.ticker} />
        </div>

        {/* News and Social Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent News */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-primary" />
              Recent News
            </h2>
            {recentNews.length > 0 ? (
              <div className="space-y-4">
                {recentNews.map((news) => (
                  <a
                    key={news.id}
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-background rounded-lg hover:bg-background/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-text-primary line-clamp-2">
                          {news.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                          <span>{news.source}</span>
                          <span>•</span>
                          <span>
                            {news.publishedAt.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            news.sentiment === 'positive'
                              ? 'bg-positive/20 text-positive'
                              : news.sentiment === 'negative'
                                ? 'bg-negative/20 text-negative'
                                : 'bg-neutral/20 text-neutral'
                          }`}
                        >
                          {news.sentiment}
                        </span>
                        <span className="text-xs text-text-muted font-mono-numbers">
                          Impact: {news.impactScore.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No recent news</p>
            )}
          </div>

          {/* Social Mentions */}
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-secondary" />
              Social Mentions
            </h2>
            {recentSocial.length > 0 ? (
              <div className="space-y-4">
                {recentSocial.map((social) => (
                  <div key={social.id} className="p-3 bg-background rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-text-primary text-sm">
                        {social.accountName}
                      </span>
                      <span className="text-text-muted text-xs">@{social.accountHandle}</span>
                      <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-xs rounded">
                        {social.platform}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-3">{social.content}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
                      <span>
                        {social.publishedAt.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {social.sentiment && (
                          <span
                            className={`px-2 py-0.5 rounded ${
                              social.sentiment === 'positive'
                                ? 'bg-positive/20 text-positive'
                                : social.sentiment === 'negative'
                                  ? 'bg-negative/20 text-negative'
                                  : 'bg-neutral/20 text-neutral'
                            }`}
                          >
                            {social.sentiment}
                          </span>
                        )}
                        {social.impactScore !== null && (
                          <span className="font-mono-numbers">
                            Impact: {social.impactScore.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No social mentions</p>
            )}
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
