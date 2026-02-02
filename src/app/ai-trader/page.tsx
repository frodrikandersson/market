'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bot, TrendingUp, TrendingDown, RefreshCw, Play, DollarSign, Brain, Zap, Combine } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';

type ModelType = 'fundamentals' | 'hype' | 'combined';

interface Position {
  id: string;
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
  companyId: string;
  createdAt: string;
}

interface Trade {
  id: string;
  ticker: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  totalValue: number;
  executedAt: string;
  modelType: string | null;
  note: string | null;
}

interface Portfolio {
  id: string;
  name: string;
  startingCash: number;
  currentCash: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

interface PortfolioStatus {
  modelType: ModelType;
  name: string;
  description: string;
  portfolio: Portfolio;
  positions: Position[];
  recentTrades: Trade[];
}

interface Config {
  MIN_CONFIDENCE: number;
  HIGH_CONFIDENCE: number;
  POSITION_SIZE_NORMAL: number;
  POSITION_SIZE_HIGH: number;
  MAX_POSITIONS: number;
  MAX_SINGLE_POSITION: number;
  PROFIT_TARGET: number;
  STOP_LOSS: number;
  MAX_HOLD_DAYS: number;
  REVERSAL_CONFIDENCE: number;
}

const MODEL_ICONS: Record<ModelType, React.ReactNode> = {
  fundamentals: <Brain className="w-5 h-5" />,
  hype: <Zap className="w-5 h-5" />,
  combined: <Combine className="w-5 h-5" />,
};

const MODEL_COLORS: Record<ModelType, string> = {
  fundamentals: 'text-primary',
  hype: 'text-secondary',
  combined: 'text-positive',
};

const MODEL_BG: Record<ModelType, string> = {
  fundamentals: 'bg-primary/10 border-primary/30',
  hype: 'bg-secondary/10 border-secondary/30',
  combined: 'bg-positive/10 border-positive/30',
};

export default function AITraderPage() {
  const [portfolios, setPortfolios] = useState<PortfolioStatus[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType | 'all'>('all');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-trader');
      const data = await response.json();

      if (data.success) {
        setPortfolios(data.portfolios);
        setConfig(data.config);
      } else {
        setError(data.error || 'Failed to load AI portfolios');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runAutoTrader = async () => {
    setIsRunning(true);
    setLastRunResult(null);
    setError(null);

    try {
      const response = await fetch('/api/auto-trader', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        const details = data.portfolios
          .map((p: { modelType: string; tradesExecuted: number }) =>
            `${p.modelType}: ${p.tradesExecuted}`)
          .join(', ');
        setLastRunResult(
          `Executed ${data.totalTradesExecuted} total trades (${details})`
        );
        fetchData();
      } else {
        setError(data.error || 'Failed to run auto-trader');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
      </main>
    );
  }

  // Calculate totals for comparison
  const totalValue = portfolios.reduce((sum, p) => sum + p.portfolio.totalValue, 0);
  const totalGainLoss = portfolios.reduce((sum, p) => sum + p.portfolio.totalGainLoss, 0);

  // Get portfolios to display based on selection
  const displayPortfolios = selectedModel === 'all'
    ? portfolios
    : portfolios.filter(p => p.modelType === selectedModel);

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-text-primary">AI Auto-Traders</h1>
              <p className="text-text-secondary">
                Compare performance across prediction models
              </p>
            </div>
          </div>
          <button
            onClick={runAutoTrader}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isRunning
                ? 'bg-border text-text-muted cursor-wait'
                : 'bg-primary text-background hover:bg-primary/90'
            }`}
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'Running...' : 'Run All'}
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-negative/10 border border-negative/30 rounded-lg text-negative">
            {error}
          </div>
        )}
        {lastRunResult && (
          <div className="mb-6 p-4 bg-positive/10 border border-positive/30 rounded-lg text-positive">
            {lastRunResult}
          </div>
        )}

        {/* Combined Overview */}
        <div className="bg-surface rounded-lg border border-border p-6 mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-6">Combined Overview</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-text-muted text-xs md:text-sm">Total Across All</p>
              <p className="text-lg md:text-2xl font-bold font-mono-numbers text-text-primary break-all">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs md:text-sm">Combined P&L</p>
              <p className={`text-lg md:text-2xl font-bold font-mono-numbers break-all ${totalGainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalGainLoss >= 0 ? '+' : ''}${totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs md:text-sm">Starting Capital (Each)</p>
              <p className="text-lg md:text-2xl font-bold font-mono-numbers text-text-secondary">
                ${portfolios[0]?.portfolio.startingCash.toLocaleString() || '100,000'}
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs md:text-sm">Active Portfolios</p>
              <p className="text-lg md:text-2xl font-bold font-mono-numbers text-primary">
                {portfolios.length}
              </p>
            </div>
          </div>

          {/* Portfolio Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {portfolios.map((p) => (
              <div
                key={p.modelType}
                className={`rounded-lg border p-4 ${MODEL_BG[p.modelType]} cursor-pointer transition-all hover:scale-[1.02]`}
                onClick={() => setSelectedModel(selectedModel === p.modelType ? 'all' : p.modelType)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={MODEL_COLORS[p.modelType]}>
                    {MODEL_ICONS[p.modelType]}
                  </span>
                  <h3 className="font-semibold text-text-primary capitalize">{p.modelType}</h3>
                  {selectedModel === p.modelType && (
                    <span className="ml-auto text-xs bg-text-primary text-background px-2 py-0.5 rounded">
                      Selected
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-text-muted">Value</span>
                    <span className="font-mono-numbers text-text-primary text-xs md:text-sm truncate">
                      ${p.portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-text-muted">Return</span>
                    <span className={`font-mono-numbers ${p.portfolio.totalGainLossPercent >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {p.portfolio.totalGainLossPercent >= 0 ? '+' : ''}{p.portfolio.totalGainLossPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-text-muted">Positions</span>
                    <span className="font-mono-numbers text-text-secondary">
                      {p.positions.length}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedModel('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              selectedModel === 'all'
                ? 'bg-primary text-background'
                : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            All Models
          </button>
          {(['fundamentals', 'hype', 'combined'] as ModelType[]).map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors capitalize whitespace-nowrap flex-shrink-0 ${
                selectedModel === model
                  ? `${MODEL_BG[model]} ${MODEL_COLORS[model]}`
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {MODEL_ICONS[model]}
              {model}
            </button>
          ))}
        </div>

        {/* Portfolio Details */}
        {displayPortfolios.map((p) => (
          <div key={p.modelType} className="mb-8">
            {/* Portfolio Header */}
            <div className={`bg-surface rounded-lg border p-6 mb-4 ${
              selectedModel !== 'all' ? MODEL_BG[p.modelType] : 'border-border'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <span className={MODEL_COLORS[p.modelType]}>
                  {MODEL_ICONS[p.modelType]}
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{p.name}</h2>
                  <p className="text-text-muted text-sm">{p.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-text-muted text-xs md:text-sm">Total Value</p>
                  <p className="text-lg md:text-2xl font-bold font-mono-numbers text-text-primary break-all">
                    ${p.portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs md:text-sm">Cash Available</p>
                  <p className="text-lg md:text-2xl font-bold font-mono-numbers text-primary break-all">
                    ${p.portfolio.currentCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs md:text-sm">Starting Capital</p>
                  <p className="text-lg md:text-2xl font-bold font-mono-numbers text-text-secondary">
                    ${p.portfolio.startingCash.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs md:text-sm">Total P&L</p>
                  <p className={`text-lg md:text-2xl font-bold font-mono-numbers break-all ${p.portfolio.totalGainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {p.portfolio.totalGainLoss >= 0 ? '+' : ''}${p.portfolio.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs md:text-sm">Return</p>
                  <p className={`text-lg md:text-2xl font-bold font-mono-numbers ${p.portfolio.totalGainLossPercent >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {p.portfolio.totalGainLossPercent >= 0 ? '+' : ''}{p.portfolio.totalGainLossPercent.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${p.portfolio.totalGainLoss >= 0 ? 'bg-positive' : 'bg-negative'}`}
                    style={{
                      width: `${Math.min(100, Math.max(0, 50 + p.portfolio.totalGainLossPercent))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>-50%</span>
                  <span>Starting: ${p.portfolio.startingCash.toLocaleString()}</span>
                  <span>+50%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Positions */}
              <div className="lg:col-span-2">
                <div className="bg-surface rounded-lg border border-border overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-primary">
                      Positions ({p.positions.length})
                    </h3>
                  </div>
                  {p.positions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-text-muted border-b border-border bg-background/50">
                            <th className="px-4 py-3 font-medium">Symbol</th>
                            <th className="px-4 py-3 font-medium text-right">Shares</th>
                            <th className="px-4 py-3 font-medium text-right">Avg Cost</th>
                            <th className="px-4 py-3 font-medium text-right">Current</th>
                            <th className="px-4 py-3 font-medium text-right">Value</th>
                            <th className="px-4 py-3 font-medium text-right">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.positions.map((pos) => (
                            <tr key={pos.id} className="border-b border-border/50 hover:bg-background/30">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/stock/${pos.ticker}`}
                                  className="font-bold text-text-primary hover:text-primary"
                                >
                                  {pos.ticker}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-right font-mono-numbers text-text-secondary">
                                {pos.shares.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono-numbers text-text-secondary">
                                ${pos.avgCost.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono-numbers text-text-primary">
                                ${pos.currentPrice.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono-numbers text-text-primary">
                                ${pos.marketValue.toFixed(2)}
                              </td>
                              <td className={`px-4 py-3 text-right font-mono-numbers ${pos.gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                <div className="flex items-center justify-end gap-1">
                                  {pos.gainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {pos.gainLoss >= 0 ? '+' : ''}{pos.gainLoss.toFixed(2)}
                                  <span className="text-xs">({pos.gainLossPercent >= 0 ? '+' : ''}{pos.gainLossPercent.toFixed(1)}%)</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-text-muted">
                      No positions yet. The AI will buy stocks based on high-confidence predictions.
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Trades */}
              <div>
                <div className="bg-surface rounded-lg border border-border overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-primary">Recent Trades</h3>
                  </div>
                  {p.recentTrades.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      {p.recentTrades.slice(0, 10).map((trade) => (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-background/30"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${
                                trade.type === 'buy'
                                  ? 'bg-positive/20 text-positive'
                                  : 'bg-negative/20 text-negative'
                              }`}
                            >
                              {trade.type.toUpperCase()}
                            </span>
                            <div>
                              <span className="font-bold text-text-primary">{trade.ticker}</span>
                              <span className="text-text-muted text-sm ml-2">
                                {trade.shares.toFixed(2)} @ ${trade.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono-numbers text-text-primary text-sm">
                              ${trade.totalValue.toFixed(2)}
                            </div>
                            <div className="text-xs text-text-muted">
                              {new Date(trade.executedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-text-muted">
                      No trades yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Trading Config */}
        {config && (
          <div className="bg-surface rounded-lg border border-border p-6 mt-8">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Trading Rules (All Models)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-text-muted">Min Confidence</span>
                <span className="font-mono-numbers text-text-primary">{(config.MIN_CONFIDENCE * 100).toFixed(0)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Position Size</span>
                <span className="font-mono-numbers text-text-primary">{(config.POSITION_SIZE_NORMAL * 100).toFixed(0)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Max Positions</span>
                <span className="font-mono-numbers text-text-primary">{config.MAX_POSITIONS}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Profit Target</span>
                <span className="font-mono-numbers text-positive">+{(config.PROFIT_TARGET * 100).toFixed(0)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Stop Loss</span>
                <span className="font-mono-numbers text-negative">{(config.STOP_LOSS * 100).toFixed(0)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-text-muted">Max Hold Days</span>
                <span className="font-mono-numbers text-text-primary">{config.MAX_HOLD_DAYS}</span>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>How it works:</strong> Three AI portfolios trade independently based on different signals.
            <strong className="text-primary ml-2">Fundamentals</strong> uses news sentiment,
            <strong className="text-secondary ml-2">Hype</strong> uses social media sentiment, and
            <strong className="text-positive ml-2">Combined</strong> only trades when both models agree.
            Each portfolio starts with $100,000 to allow fair comparison.
          </p>
        </div>
      </div>
    </main>
  );
}
