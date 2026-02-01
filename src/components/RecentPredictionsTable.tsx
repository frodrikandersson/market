'use client';

import { useState, useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import Link from 'next/link';

interface Prediction {
  id: string;
  ticker: string;
  modelType: 'fundamentals' | 'hype';
  predictedDirection: 'up' | 'down';
  actualDirection: 'up' | 'down' | 'flat' | null;
  confidence: number;
  wasCorrect: boolean | null;
  targetDate: Date;
  predictionDate: Date;
  actualChange: number | null;
  timeframe?: string;
  targetTime?: Date | null;
  baselinePrice: number | null;
  predictedChange: number | null;
  currentPrice: number | null;
  currentChange: number | null;
}

interface RecentPredictionsTableProps {
  predictions: Prediction[];
}

type ModelFilter = 'all' | 'fundamentals' | 'hype';
type ResultFilter = 'all' | 'correct' | 'wrong' | 'pending';
type DirectionFilter = 'all' | 'up' | 'down';

export function RecentPredictionsTable({ predictions }: RecentPredictionsTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [modelFilter, setModelFilter] = useState<ModelFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');

  // Filter predictions
  const filteredPredictions = useMemo(() => {
    let filtered = [...predictions];

    // Model filter
    if (modelFilter !== 'all') {
      filtered = filtered.filter((p) => p.modelType === modelFilter);
    }

    // Result filter
    if (resultFilter !== 'all') {
      if (resultFilter === 'pending') {
        filtered = filtered.filter((p) => p.wasCorrect === null);
      } else if (resultFilter === 'correct') {
        filtered = filtered.filter((p) => p.wasCorrect === true);
      } else if (resultFilter === 'wrong') {
        filtered = filtered.filter((p) => p.wasCorrect === false);
      }
    }

    // Direction filter
    if (directionFilter !== 'all') {
      filtered = filtered.filter((p) => p.predictedDirection === directionFilter);
    }

    // Confidence filter
    filtered = filtered.filter((p) => p.confidence * 100 >= minConfidence);

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const cutoffDate = new Date(now.getTime() - daysMap[dateRange] * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => p.predictionDate >= cutoffDate);
    }

    return filtered;
  }, [predictions, modelFilter, resultFilter, directionFilter, minConfidence, dateRange]);

  const hasActiveFilters =
    modelFilter !== 'all' ||
    resultFilter !== 'all' ||
    directionFilter !== 'all' ||
    minConfidence > 0 ||
    dateRange !== 'all';

  const clearFilters = () => {
    setModelFilter('all');
    setResultFilter('all');
    setDirectionFilter('all');
    setMinConfidence(0);
    setDateRange('all');
  };

  // Check if prediction target time has passed
  const isPredictionDue = (pred: Prediction) => {
    const now = new Date();
    const targetDateTime = pred.targetTime || pred.targetDate;
    return targetDateTime <= now;
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4 md:p-6">
      {/* Header with Filter Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-text-primary">Recent Predictions</h2>
          <p className="text-xs text-text-muted mt-1">
            {filteredPredictions.length} of {predictions.length} predictions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs bg-negative/10 text-negative border border-negative/30 rounded hover:bg-negative/20 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-background text-text-secondary border border-border hover:border-primary/30'
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            {/* Model Filter */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Model</label>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value as ModelFilter)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">All Models</option>
                <option value="fundamentals">Fundamentals</option>
                <option value="hype">Hype Model</option>
              </select>
            </div>

            {/* Result Filter */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Result</label>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">All Results</option>
                <option value="correct">Correct</option>
                <option value="wrong">Wrong</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Direction Filter */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Predicted Direction</label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">All Directions</option>
                <option value="up">Bullish (UP)</option>
                <option value="down">Bearish (DOWN)</option>
              </select>
            </div>

            {/* Minimum Confidence */}
            <div>
              <label className="text-xs text-text-muted block mb-2">
                Min Confidence: {minConfidence}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredPredictions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="pb-3 font-medium text-xs">Made</th>
                <th className="pb-3 font-medium text-xs">Ticker</th>
                <th className="pb-3 font-medium text-xs">Model</th>
                <th className="pb-3 font-medium text-xs">Predicted</th>
                <th className="pb-3 font-medium text-xs">Target</th>
                <th className="pb-3 font-medium text-xs">Actual/Current</th>
                <th className="pb-3 font-medium text-xs">Confidence</th>
                <th className="pb-3 font-medium text-xs">Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredPredictions.map((pred) => {
                const isDue = isPredictionDue(pred);
                return (
                  <tr key={pred.id} className="border-b border-border/50 hover:bg-background/50">
                    {/* Prediction Date */}
                    <td className="py-3 font-mono-numbers text-text-secondary text-xs">
                      {pred.predictionDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Ticker */}
                    <td className="py-3">
                      <Link
                        href={`/stock/${pred.ticker}`}
                        className="font-semibold text-text-primary hover:text-primary transition-colors"
                      >
                        {pred.ticker}
                      </Link>
                    </td>

                    {/* Model */}
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

                    {/* Predicted Direction + Baseline Price + Predicted Change */}
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span
                          className={
                            pred.predictedDirection === 'up' ? 'text-positive' : 'text-negative'
                          }
                        >
                          {pred.predictedDirection === 'up' ? '▲ UP' : '▼ DOWN'}
                        </span>
                        {pred.baselinePrice && (
                          <span className="text-text-muted text-xs">
                            from ${pred.baselinePrice.toFixed(2)}
                          </span>
                        )}
                        {pred.predictedChange !== null && (
                          <span className="text-xs text-primary/70">
                            ({pred.predictedChange > 0 ? '+' : ''}
                            {pred.predictedChange.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Target Date/Time */}
                    <td className="py-3 font-mono-numbers text-xs">
                      <div className="flex flex-col">
                        <span className="text-text-secondary">
                          {pred.targetDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {pred.targetTime && (
                          <span className="text-text-muted text-xs">
                            {pred.targetTime.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        {pred.timeframe && (
                          <span className="text-xs text-primary/70 mt-0.5">
                            ({pred.timeframe})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actual/Current Direction */}
                    <td className="py-3">
                      {pred.actualDirection ? (
                        // After evaluation: show final result
                        <div className="flex flex-col">
                          <span
                            className={
                              pred.actualDirection === 'up'
                                ? 'text-positive'
                                : pred.actualDirection === 'down'
                                  ? 'text-negative'
                                  : 'text-text-muted'
                            }
                          >
                            {pred.actualDirection === 'up'
                              ? '▲ UP'
                              : pred.actualDirection === 'down'
                                ? '▼ DOWN'
                                : '━ FLAT'}
                          </span>
                          {pred.actualChange !== null && (
                            <span className="text-text-muted text-xs">
                              ({pred.actualChange > 0 ? '+' : ''}
                              {pred.actualChange.toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      ) : pred.currentPrice ? (
                        // Before evaluation: show current price from snapshots
                        <div className="flex flex-col">
                          <span className="text-text-secondary text-sm">
                            ${pred.currentPrice.toFixed(2)}
                          </span>
                          {pred.currentChange !== null && (
                            <span
                              className={`text-xs ${
                                pred.currentChange > 0
                                  ? 'text-positive'
                                  : pred.currentChange < 0
                                    ? 'text-negative'
                                    : 'text-text-muted'
                              }`}
                            >
                              ({pred.currentChange > 0 ? '+' : ''}
                              {pred.currentChange.toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">
                          {isDue ? 'Evaluating...' : 'Pending'}
                        </span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pred.modelType === 'fundamentals' ? 'bg-primary' : 'bg-secondary'
                            }`}
                            style={{ width: `${pred.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-mono-numbers text-text-secondary text-xs">
                          {(pred.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Result */}
                    <td className="py-3">
                      {pred.wasCorrect !== null && isDue ? (
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            pred.wasCorrect
                              ? 'bg-positive/20 text-positive'
                              : 'bg-negative/20 text-negative'
                          }`}
                        >
                          {pred.wasCorrect ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">
            {hasActiveFilters
              ? 'No predictions match your filters'
              : 'No predictions available yet'}
          </p>
        </div>
      )}
    </div>
  );
}
