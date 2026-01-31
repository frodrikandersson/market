'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, Trash2 } from 'lucide-react';

interface Position {
  id: string;
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

interface Portfolio {
  id: string;
  name: string;
  startingCash: number;
  currentCash: number;
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  positions: Position[];
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
}

interface Metrics {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalVolume: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgGainPercent: number;
  avgLossPercent: number;
}

interface PortfolioSummaryProps {
  portfolio: Portfolio;
  onReset: () => void;
  isResetting: boolean;
}

export function PortfolioSummary({ portfolio, onReset, isResetting }: PortfolioSummaryProps) {
  const isPositive = portfolio.totalGainLoss >= 0;

  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{portfolio.name}</h2>
        <button
          onClick={onReset}
          disabled={isResetting}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-negative hover:bg-negative/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          <p className="text-text-muted text-sm">Total P&L</p>
          <p className={`text-2xl font-bold font-mono-numbers ${isPositive ? 'text-positive' : 'text-negative'}`}>
            {isPositive ? '+' : ''}{portfolio.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-text-muted text-sm">Return</p>
          <p className={`text-2xl font-bold font-mono-numbers ${isPositive ? 'text-positive' : 'text-negative'}`}>
            {isPositive ? '+' : ''}{portfolio.totalGainLossPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${isPositive ? 'bg-positive' : 'bg-negative'}`}
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
  );
}

interface PositionsListProps {
  positions: Position[];
  onSell: (ticker: string, maxShares: number) => void;
}

export function PositionsList({ positions, onSell }: PositionsListProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6 text-center">
        <p className="text-text-muted">No positions yet. Start trading!</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">Positions</h3>
      </div>
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
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos.id} className="border-b border-border/50 hover:bg-background/30">
                <td className="px-4 py-3">
                  <span className="font-bold text-text-primary">{pos.ticker}</span>
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
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onSell(pos.ticker, pos.shares)}
                    className="px-3 py-1 text-xs bg-negative/10 text-negative rounded hover:bg-negative/20 transition-colors"
                  >
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TradeFormProps {
  onTrade: (ticker: string, type: 'buy' | 'sell', shares: number) => void;
  isTrading: boolean;
  availableCash: number;
  defaultTicker?: string;
  defaultType?: 'buy' | 'sell';
  maxShares?: number;
}

export function TradeForm({ onTrade, isTrading, availableCash, defaultTicker, defaultType, maxShares }: TradeFormProps) {
  const [ticker, setTicker] = useState(defaultTicker || '');
  const [type, setType] = useState<'buy' | 'sell'>(defaultType || 'buy');
  const [shares, setShares] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker && shares) {
      onTrade(ticker.toUpperCase(), type, Number(shares));
      setTicker(defaultTicker || '');
      setShares('');
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Execute Trade
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('buy')}
            className={`py-2 rounded font-medium transition-colors ${
              type === 'buy'
                ? 'bg-positive text-background'
                : 'bg-background text-text-secondary hover:text-positive'
            }`}
          >
            BUY
          </button>
          <button
            type="button"
            onClick={() => setType('sell')}
            className={`py-2 rounded font-medium transition-colors ${
              type === 'sell'
                ? 'bg-negative text-background'
                : 'bg-background text-text-secondary hover:text-negative'
            }`}
          >
            SELL
          </button>
        </div>

        <div>
          <label className="text-text-muted text-sm block mb-1">Symbol</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary font-mono-numbers focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-text-muted text-sm block mb-1">
            Shares
            {maxShares && type === 'sell' && (
              <button
                type="button"
                onClick={() => setShares(maxShares.toString())}
                className="ml-2 text-primary hover:underline"
              >
                Max: {maxShares}
              </button>
            )}
          </label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="10"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary font-mono-numbers focus:border-primary focus:outline-none"
          />
        </div>

        <div className="text-sm text-text-muted">
          Available: <span className="font-mono-numbers text-primary">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <button
          type="submit"
          disabled={isTrading || !ticker || !shares}
          className={`w-full py-3 rounded font-semibold transition-colors flex items-center justify-center gap-2 ${
            isTrading
              ? 'bg-border text-text-muted cursor-wait'
              : type === 'buy'
                ? 'bg-positive text-background hover:bg-positive/90'
                : 'bg-negative text-background hover:bg-negative/90'
          }`}
        >
          {isTrading && <RefreshCw className="w-4 h-4 animate-spin" />}
          {isTrading ? 'Executing...' : `${type.toUpperCase()} ${ticker || 'STOCK'}`}
        </button>
      </form>
    </div>
  );
}

interface TradeHistoryProps {
  trades: Trade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-border p-6 text-center">
        <p className="text-text-muted">No trades yet</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">Recent Trades</h3>
      </div>
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
                  {trade.shares} @ ${trade.price.toFixed(2)}
                </span>
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
    </div>
  );
}

interface PerformanceMetricsProps {
  metrics: Metrics;
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Performance</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-text-muted text-xs">Total Trades</p>
          <p className="text-xl font-bold font-mono-numbers text-text-primary">{metrics.totalTrades}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Volume</p>
          <p className="text-xl font-bold font-mono-numbers text-text-primary">
            ${(metrics.totalVolume / 1000).toFixed(1)}K
          </p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Win Rate</p>
          <p className={`text-xl font-bold font-mono-numbers ${metrics.winRate >= 50 ? 'text-positive' : 'text-negative'}`}>
            {metrics.winRate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-text-muted text-xs">W/L</p>
          <p className="text-xl font-bold font-mono-numbers text-text-primary">
            <span className="text-positive">{metrics.winningTrades}</span>
            /
            <span className="text-negative">{metrics.losingTrades}</span>
          </p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Avg Win</p>
          <p className="text-lg font-bold font-mono-numbers text-positive">
            +{metrics.avgGainPercent.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Avg Loss</p>
          <p className="text-lg font-bold font-mono-numbers text-negative">
            {metrics.avgLossPercent.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
