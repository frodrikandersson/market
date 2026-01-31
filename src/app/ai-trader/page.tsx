'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bot, TrendingUp, TrendingDown, RefreshCw, Play, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';

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

export default function AITraderPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-trader');
      const data = await response.json();

      if (data.success) {
        setPortfolio(data.portfolio);
        setPositions(data.positions);
        setTrades(data.recentTrades);
        setConfig(data.config);
      } else {
        setError(data.error || 'Failed to load AI portfolio');
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
        setLastRunResult(
          `Executed ${data.tradesExecuted} trades (${data.buyOrders} buys, ${data.sellOrders} sells)`
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
              <h1 className="text-3xl font-bold text-text-primary">AI Auto-Trader</h1>
              <p className="text-text-secondary">
                Automated trading based on prediction models
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
            {isRunning ? 'Running...' : 'Run Now'}
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

        {/* Portfolio Summary */}
        {portfolio && (
          <div className="bg-surface rounded-lg border border-border p-6 mb-8">
            <h2 className="text-xl font-semibold text-text-primary mb-6">Portfolio Performance</h2>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-text-muted text-sm">Total Value</p>
                <p className="text-2xl font-bold font-mono-numbers text-text-primary">
                  ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-sm">Cash Available</p>
                <p className="text-2xl font-bold font-mono-numbers text-primary">
                  ${portfolio.currentCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-sm">Starting Capital</p>
                <p className="text-2xl font-bold font-mono-numbers text-text-secondary">
                  ${portfolio.startingCash.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-sm">Total P&L</p>
                <p className={`text-2xl font-bold font-mono-numbers ${portfolio.totalGainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {portfolio.totalGainLoss >= 0 ? '+' : ''}${portfolio.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-sm">Return</p>
                <p className={`text-2xl font-bold font-mono-numbers ${portfolio.totalGainLossPercent >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {portfolio.totalGainLossPercent >= 0 ? '+' : ''}{portfolio.totalGainLossPercent.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${portfolio.totalGainLoss >= 0 ? 'bg-positive' : 'bg-negative'}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, 50 + portfolio.totalGainLossPercent))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>-50%</span>
                <span>Starting: ${portfolio.startingCash.toLocaleString()}</span>
                <span>+50%</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Positions */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text-primary">
                  Current Positions ({positions.length})
                </h3>
              </div>
              {positions.length > 0 ? (
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
                      {positions.map((pos) => (
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trading Config */}
            {config && (
              <div className="bg-surface rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Trading Rules
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Min Confidence</span>
                    <span className="font-mono-numbers text-text-primary">{(config.MIN_CONFIDENCE * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Position Size</span>
                    <span className="font-mono-numbers text-text-primary">{(config.POSITION_SIZE_NORMAL * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Max Positions</span>
                    <span className="font-mono-numbers text-text-primary">{config.MAX_POSITIONS}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Profit Target</span>
                    <span className="font-mono-numbers text-positive">+{(config.PROFIT_TARGET * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Stop Loss</span>
                    <span className="font-mono-numbers text-negative">{(config.STOP_LOSS * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Max Hold Days</span>
                    <span className="font-mono-numbers text-text-primary">{config.MAX_HOLD_DAYS}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Trades */}
            <div className="bg-surface rounded-lg border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text-primary">Recent Trades</h3>
              </div>
              {trades.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  {trades.map((trade) => (
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
                          {trade.modelType && (
                            <span className={`ml-2 text-xs ${trade.modelType === 'fundamentals' ? 'text-primary' : 'text-secondary'}`}>
                              [{trade.modelType}]
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono-numbers text-text-primary">
                          ${trade.totalValue.toFixed(2)}
                        </div>
                        <div className="text-xs text-text-muted">
                          {new Date(trade.executedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
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

        {/* Info */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>How it works:</strong> The AI auto-trader analyzes predictions from both the Fundamentals
            and Hype models. It buys stocks when predictions have {'>'}65% confidence for upward movement,
            and sells when profit targets are hit, stop-losses trigger, or predictions reverse.
            This runs automatically after each prediction cycle.
          </p>
        </div>
      </div>
    </main>
  );
}
