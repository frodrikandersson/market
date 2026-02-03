'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Filter, X, ChevronDown, Calendar, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type ModelFilter = 'all' | 'fundamentals' | 'hype';
type ResultFilter = 'all' | 'correct' | 'wrong' | 'pending';
type DirectionFilter = 'all' | 'up' | 'down';
type DateRangeType = 'all' | '7d' | '30d' | '90d' | 'custom';
type ViewMode = 'list' | 'grouped';

// Group predictions by company ticker
interface GroupedPredictions {
  ticker: string;
  fundamentals: Prediction[];
  hype: Prediction[];
  latestDate: Date;
}

const ITEMS_PER_PAGE = 50;

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function RecentPredictionsTable() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState<ModelFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search query for API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Build API URL with filters
  const buildApiUrl = useCallback((page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', ITEMS_PER_PAGE.toString());

    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    }

    if (modelFilter !== 'all') {
      params.set('model', modelFilter);
    }

    if (resultFilter !== 'all') {
      params.set('result', resultFilter);
    }

    if (directionFilter !== 'all') {
      params.set('direction', directionFilter);
    }

    if (minConfidence > 0) {
      params.set('minConfidence', minConfidence.toString());
    }

    // Handle date range
    if (dateRange === 'custom') {
      if (customStartDate) {
        params.set('startDate', customStartDate);
      }
      if (customEndDate) {
        params.set('endDate', customEndDate);
      }
    } else if (dateRange !== 'all') {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysMap[dateRange]);
      params.set('startDate', cutoffDate.toISOString().split('T')[0]);
    }

    return `/api/predictions?${params.toString()}`;
  }, [debouncedSearch, modelFilter, resultFilter, directionFilter, minConfidence, dateRange, customStartDate, customEndDate]);

  // Fetch predictions from API
  const fetchPredictions = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = buildApiUrl(page);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();

      // Parse dates from API response
      const parsedPredictions = data.predictions.map((p: Record<string, unknown>) => ({
        ...p,
        targetDate: new Date(p.targetDate as string),
        predictionDate: new Date(p.predictionDate as string),
        targetTime: p.targetTime ? new Date(p.targetTime as string) : null,
      }));

      setPredictions(parsedPredictions);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch predictions');
    } finally {
      setIsLoading(false);
    }
  }, [buildApiUrl]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, modelFilter, resultFilter, directionFilter, minConfidence, dateRange, customStartDate, customEndDate]);

  // Fetch predictions when page or filters change
  useEffect(() => {
    fetchPredictions(currentPage);
  }, [currentPage, fetchPredictions]);

  // Group predictions by company ticker (for grouped view)
  const groupedPredictions = useMemo(() => {
    const groups: Record<string, GroupedPredictions> = {};

    for (const pred of predictions) {
      if (!groups[pred.ticker]) {
        groups[pred.ticker] = {
          ticker: pred.ticker,
          fundamentals: [],
          hype: [],
          latestDate: pred.predictionDate,
        };
      }

      if (pred.modelType === 'fundamentals') {
        groups[pred.ticker].fundamentals.push(pred);
      } else {
        groups[pred.ticker].hype.push(pred);
      }

      // Track latest prediction date for sorting
      if (pred.predictionDate > groups[pred.ticker].latestDate) {
        groups[pred.ticker].latestDate = pred.predictionDate;
      }
    }

    // Sort each model's predictions by date (newest first)
    for (const group of Object.values(groups)) {
      group.fundamentals.sort((a, b) => b.predictionDate.getTime() - a.predictionDate.getTime());
      group.hype.sort((a, b) => b.predictionDate.getTime() - a.predictionDate.getTime());
    }

    // Return sorted by latest date
    return Object.values(groups).sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
  }, [predictions]);

  const toggleExpandedTicker = (ticker: string) => {
    setExpandedTickers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticker)) {
        newSet.delete(ticker);
      } else {
        newSet.add(ticker);
      }
      return newSet;
    });
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    modelFilter !== 'all' ||
    resultFilter !== 'all' ||
    directionFilter !== 'all' ||
    minConfidence > 0 ||
    dateRange !== 'all' ||
    customStartDate !== '' ||
    customEndDate !== '';

  const clearFilters = () => {
    setSearchQuery('');
    setModelFilter('all');
    setResultFilter('all');
    setDirectionFilter('all');
    setMinConfidence(0);
    setDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Check if prediction target time has passed
  const isPredictionDue = (pred: Prediction) => {
    const now = new Date();
    const targetDateTime = pred.targetTime || pred.targetDate;
    return targetDateTime <= now;
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && (!pagination || page <= pagination.totalPages)) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4 md:p-6">
      {/* Header with Search and Filter Toggle */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-text-primary">Recent Predictions</h2>
            <p className="text-xs text-text-muted mt-1">
              {pagination ? (
                <>
                  {predictions.length} of {pagination.totalCount.toLocaleString()} predictions
                  {pagination.totalPages > 1 && (
                    <span className="ml-2">
                      (Page {pagination.page} of {pagination.totalPages})
                    </span>
                  )}
                </>
              ) : (
                'Loading...'
              )}
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

        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by ticker (searches all predictions)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-background border border-border rounded-lg p-4 mb-4 space-y-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 pb-3 border-b border-border/50">
            <span className="text-xs text-text-muted">View:</span>
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-surface text-text-secondary border border-border hover:border-primary/30'
              }`}
            >
              Grouped by Stock
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-surface text-text-secondary border border-border hover:border-primary/30'
              }`}
            >
              List View
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div>
              <label className="text-xs text-text-muted block mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeType)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Range Inputs */}
            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="text-xs text-text-muted block mb-2">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-2">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </>
            )}

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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-text-muted">Loading predictions...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-12">
          <p className="text-negative text-sm mb-2">Error: {error}</p>
          <button
            onClick={() => fetchPredictions(currentPage)}
            className="text-primary text-sm hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Grouped View */}
      {!isLoading && !error && viewMode === 'grouped' && groupedPredictions.length > 0 && (
        <div className="space-y-4">
          {groupedPredictions.map((group) => (
            <GroupedPredictionCard
              key={group.ticker}
              group={group}
              isExpanded={expandedTickers.has(group.ticker)}
              onToggle={() => toggleExpandedTicker(group.ticker)}
              isPredictionDue={isPredictionDue}
            />
          ))}
        </div>
      )}

      {/* List View - Mobile: Card Layout */}
      {!isLoading && !error && viewMode === 'list' && predictions.length > 0 ? (
        <>
          {/* Mobile Cards (< lg) */}
          <div className="lg:hidden space-y-3">
            {predictions.map((pred) => {
              const isDue = isPredictionDue(pred);
              return (
                <div
                  key={pred.id}
                  className="bg-background border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  {/* Header: Ticker, Model, Result */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/stock/${pred.ticker}`}
                        className="text-lg font-bold text-text-primary hover:text-primary transition-colors"
                      >
                        {pred.ticker}
                      </Link>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          pred.modelType === 'fundamentals'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-secondary/20 text-secondary'
                        }`}
                      >
                        {pred.modelType === 'fundamentals' ? 'Fund' : 'Hype'}
                      </span>
                    </div>
                    {pred.wasCorrect !== null && isDue ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          pred.wasCorrect
                            ? 'bg-positive/20 text-positive'
                            : 'bg-negative/20 text-negative'
                        }`}
                      >
                        {pred.wasCorrect ? '✓ Correct' : '✗ Wrong'}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">Pending</span>
                    )}
                  </div>

                  {/* Prediction Info */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Predicted */}
                    <div>
                      <div className="text-text-muted text-xs mb-1">Predicted</div>
                      <div className="flex flex-col">
                        <span
                          className={`font-semibold ${
                            pred.predictedDirection === 'up' ? 'text-positive' : 'text-negative'
                          }`}
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
                    </div>

                    {/* Actual/Current */}
                    <div>
                      <div className="text-text-muted text-xs mb-1">Actual/Current</div>
                      {pred.actualDirection ? (
                        <div className="flex flex-col">
                          <span
                            className={`font-semibold ${
                              pred.actualDirection === 'up'
                                ? 'text-positive'
                                : pred.actualDirection === 'down'
                                  ? 'text-negative'
                                  : 'text-text-muted'
                            }`}
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
                        <div className="flex flex-col">
                          <span className="text-text-secondary text-sm font-semibold">
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
                    </div>
                  </div>

                  {/* Footer: Dates and Confidence */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-text-muted">Made: </span>
                        <span className="text-text-secondary font-mono-numbers">
                          {pred.predictionDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Target: </span>
                        <span className="text-text-secondary font-mono-numbers">
                          {pred.targetDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {pred.timeframe && (
                          <span className="text-primary/70 ml-1">({pred.timeframe})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-surface rounded-full overflow-hidden">
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
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Table Layout (>= lg) */}
          <div className="hidden lg:block overflow-x-auto">
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
                {predictions.map((pred) => {
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
        </>
      ) : viewMode === 'list' && !isLoading && !error ? (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">
            {hasActiveFilters
              ? 'No predictions match your filters'
              : 'No predictions available yet'}
          </p>
        </div>
      ) : null}

      {/* Empty state for grouped view */}
      {!isLoading && !error && viewMode === 'grouped' && groupedPredictions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">
            {hasActiveFilters
              ? 'No predictions match your filters'
              : 'No predictions available yet'}
          </p>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !error && pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <div className="text-xs text-text-muted">
            Showing {((pagination.page - 1) * pagination.limit) + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
            {pagination.totalCount.toLocaleString()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={!pagination.hasPrevPage}
              className="px-2 py-1 text-xs bg-background border border-border rounded hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="p-1 bg-background border border-border rounded hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      pageNum === currentPage
                        ? 'bg-primary text-background'
                        : 'bg-background border border-border hover:border-primary/30'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="p-1 bg-background border border-border rounded hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(pagination.totalPages)}
              disabled={!pagination.hasNextPage}
              className="px-2 py-1 text-xs bg-background border border-border rounded hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Grouped Prediction Card Component
interface GroupedPredictionCardProps {
  group: GroupedPredictions;
  isExpanded: boolean;
  onToggle: () => void;
  isPredictionDue: (pred: Prediction) => boolean;
}

function GroupedPredictionCard({ group, isExpanded, onToggle, isPredictionDue }: GroupedPredictionCardProps) {
  const [selectedFundDate, setSelectedFundDate] = useState(0);
  const [selectedHypeDate, setSelectedHypeDate] = useState(0);

  const fundPred = group.fundamentals[selectedFundDate];
  const hypePred = group.hype[selectedHypeDate];

  // Helper to render a model prediction block
  const renderModelPrediction = (
    pred: Prediction | undefined,
    modelType: 'fundamentals' | 'hype',
    allPredictions: Prediction[],
    selectedIndex: number,
    setSelectedIndex: (i: number) => void
  ) => {
    if (!pred) {
      return (
        <div className={`flex-1 p-3 rounded-lg bg-background/50 border ${
          modelType === 'fundamentals' ? 'border-primary/20' : 'border-secondary/20'
        }`}>
          <div className="text-xs text-text-muted mb-2">
            {modelType === 'fundamentals' ? 'FUNDAMENTALS' : 'HYPE MODEL'}
          </div>
          <div className="text-text-muted text-sm">No prediction</div>
        </div>
      );
    }

    const isDue = isPredictionDue(pred);

    return (
      <div className={`flex-1 p-3 rounded-lg ${
        modelType === 'fundamentals'
          ? 'bg-primary/5 border border-primary/20'
          : 'bg-secondary/5 border border-secondary/20'
      }`}>
        {/* Model Header with Date Selector */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${
            modelType === 'fundamentals' ? 'text-primary' : 'text-secondary'
          }`}>
            {modelType === 'fundamentals' ? 'FUNDAMENTALS' : 'HYPE MODEL'}
          </span>
          {allPredictions.length > 1 && (
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
              className="text-xs bg-surface border border-border rounded px-1 py-0.5 text-text-secondary focus:outline-none focus:border-primary"
            >
              {allPredictions.map((p, i) => (
                <option key={i} value={i}>
                  {p.predictionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Direction + Result */}
        <div className="flex items-center justify-between mb-2">
          <span className={`font-semibold ${
            pred.predictedDirection === 'up' ? 'text-positive' : 'text-negative'
          }`}>
            {pred.predictedDirection === 'up' ? '▲ UP' : '▼ DOWN'}
          </span>
          {pred.wasCorrect !== null && isDue ? (
            <span className={`px-2 py-0.5 rounded text-xs ${
              pred.wasCorrect
                ? 'bg-positive/20 text-positive'
                : 'bg-negative/20 text-negative'
            }`}>
              {pred.wasCorrect ? '✓' : '✗'}
            </span>
          ) : (
            <span className="text-text-muted text-xs">Pending</span>
          )}
        </div>

        {/* Baseline Price */}
        {pred.baselinePrice && (
          <div className="text-text-muted text-xs mb-1">
            from ${pred.baselinePrice.toFixed(2)}
          </div>
        )}

        {/* Predicted Change */}
        {pred.predictedChange !== null && (
          <div className={`text-xs ${modelType === 'fundamentals' ? 'text-primary/70' : 'text-secondary/70'}`}>
            Expected: {pred.predictedChange > 0 ? '+' : ''}{pred.predictedChange.toFixed(2)}%
          </div>
        )}

        {/* Actual Result */}
        {pred.actualDirection && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <span className={`text-xs ${
              pred.actualDirection === 'up' ? 'text-positive' : pred.actualDirection === 'down' ? 'text-negative' : 'text-text-muted'
            }`}>
              Actual: {pred.actualDirection === 'up' ? '▲' : pred.actualDirection === 'down' ? '▼' : '━'} {pred.actualChange !== null ? `${pred.actualChange > 0 ? '+' : ''}${pred.actualChange.toFixed(2)}%` : ''}
            </span>
          </div>
        )}

        {/* Confidence */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${modelType === 'fundamentals' ? 'bg-primary' : 'bg-secondary'}`}
              style={{ width: `${pred.confidence * 100}%` }}
            />
          </div>
          <span className="font-mono-numbers text-text-muted text-xs">
            {(pred.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors">
      {/* Card Header - Always Visible */}
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/stock/${group.ticker}`}
            className="text-xl font-bold text-text-primary hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {group.ticker}
          </Link>
          <div className="flex items-center gap-1">
            {group.fundamentals.length > 0 && (
              <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary">
                Fund ({group.fundamentals.length})
              </span>
            )}
            {group.hype.length > 0 && (
              <span className="px-2 py-0.5 rounded text-xs bg-secondary/20 text-secondary">
                Hype ({group.hype.length})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">
            Latest: {group.latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            {renderModelPrediction(fundPred, 'fundamentals', group.fundamentals, selectedFundDate, setSelectedFundDate)}
            {renderModelPrediction(hypePred, 'hype', group.hype, selectedHypeDate, setSelectedHypeDate)}
          </div>
        </div>
      )}
    </div>
  );
}
