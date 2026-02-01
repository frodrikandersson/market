'use client';

import type { RedditSentiment } from '@/services/dashboard-data';

interface RedditSentimentMeterProps {
  sentiment: RedditSentiment;
}

export function RedditSentimentMeter({ sentiment }: RedditSentimentMeterProps) {
  // Convert -1 to 1 scale to 0 to 100 for gauge
  const gaugeValue = ((sentiment.overall + 1) / 2) * 100;

  // Determine sentiment label and color
  const getSentimentLabel = (value: number) => {
    if (value > 0.3) return { label: 'EXTREME GREED', color: 'text-positive' };
    if (value > 0.1) return { label: 'BULLISH', color: 'text-positive' };
    if (value > -0.1) return { label: 'NEUTRAL', color: 'text-neutral' };
    if (value > -0.3) return { label: 'BEARISH', color: 'text-negative' };
    return { label: 'EXTREME FEAR', color: 'text-negative' };
  };

  const { label, color } = getSentimentLabel(sentiment.overall);

  // Calculate needle rotation (-90 to 90 degrees)
  const needleRotation = (sentiment.overall * 90);

  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <span className="text-xl">🔴</span> Reddit Sentiment
      </h3>

      {/* Gauge */}
      <div className="relative flex justify-center mb-4">
        <div className="relative w-48 h-24 overflow-hidden">
          {/* Background arc - semicircle from left (fear) to right (greed) */}
          <div
            className="absolute inset-0 rounded-t-full"
            style={{
              background: `linear-gradient(
                to right,
                #ff3366 0%,
                #ff3366 20%,
                #ffcc00 20%,
                #ffcc00 40%,
                #8b8b9a 40%,
                #8b8b9a 60%,
                #00ff88 60%,
                #00ff88 100%
              )`,
            }}
          />

          {/* Center cover */}
          <div
            className="absolute bg-surface rounded-t-full"
            style={{
              left: '15%',
              right: '15%',
              top: '30%',
              bottom: 0,
            }}
          />

          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 origin-bottom h-16 w-1 bg-text-primary rounded-full transition-transform duration-500"
            style={{
              transform: `translateX(-50%) rotate(${needleRotation}deg)`,
            }}
          />

          {/* Center dot */}
          <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-text-primary rounded-full transform -translate-x-1/2 translate-y-1/2" />
        </div>
      </div>

      {/* Labels under gauge */}
      <div className="flex justify-between text-xs text-text-muted px-2 mb-4">
        <span>FEAR</span>
        <span>NEUTRAL</span>
        <span>GREED</span>
      </div>

      {/* Current sentiment label */}
      <div className="text-center mb-4">
        <div className={`text-2xl font-bold ${color}`}>{label}</div>
        <div className="text-sm text-text-muted">
          {sentiment.totalPosts} posts in last 24h
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
        <div className="bg-positive/10 rounded p-2">
          <div className="text-positive font-bold">{sentiment.bullishCount}</div>
          <div className="text-text-muted text-xs">Bullish</div>
        </div>
        <div className="bg-neutral/10 rounded p-2">
          <div className="text-neutral font-bold">{sentiment.neutralCount}</div>
          <div className="text-text-muted text-xs">Neutral</div>
        </div>
        <div className="bg-negative/10 rounded p-2">
          <div className="text-negative font-bold">{sentiment.bearishCount}</div>
          <div className="text-text-muted text-xs">Bearish</div>
        </div>
      </div>

      {/* Subreddit breakdown */}
      {sentiment.bySubreddit.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-xs text-text-muted mb-2">BY SUBREDDIT</div>
          <div className="space-y-1.5">
            {sentiment.bySubreddit.map((sub) => (
              <div key={sub.name} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">{sub.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs">{sub.postCount} posts</span>
                  <span
                    className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                      sub.sentiment > 0.1
                        ? 'bg-positive/20 text-positive'
                        : sub.sentiment < -0.1
                          ? 'bg-negative/20 text-negative'
                          : 'bg-neutral/20 text-neutral'
                    }`}
                  >
                    {sub.sentiment > 0 ? '+' : ''}{(sub.sentiment * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top mentioned tickers */}
      {(sentiment.topBullishTickers.length > 0 || sentiment.topBearishTickers.length > 0) && (
        <div className="border-t border-border pt-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            {sentiment.topBullishTickers.length > 0 && (
              <div>
                <div className="text-xs text-positive mb-1.5">TOP BULLISH</div>
                <div className="space-y-1">
                  {sentiment.topBullishTickers.slice(0, 3).map((t) => (
                    <div key={t.ticker} className="flex justify-between text-xs">
                      <span className="text-text-primary font-mono">${t.ticker}</span>
                      <span className="text-text-muted">{t.mentions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sentiment.topBearishTickers.length > 0 && (
              <div>
                <div className="text-xs text-negative mb-1.5">TOP BEARISH</div>
                <div className="space-y-1">
                  {sentiment.topBearishTickers.slice(0, 3).map((t) => (
                    <div key={t.ticker} className="flex justify-between text-xs">
                      <span className="text-text-primary font-mono">${t.ticker}</span>
                      <span className="text-text-muted">{t.mentions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
