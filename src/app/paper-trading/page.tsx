'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, ArrowLeft, Wallet, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import {
  PortfolioSummary,
  PositionsList,
  TradeForm,
  TradeHistory,
  PerformanceMetrics,
} from '@/components/PaperTrading';

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

export default function PaperTradingPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrading, setIsTrading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // For sell modal
  const [sellTicker, setSellTicker] = useState<string | null>(null);
  const [sellMaxShares, setSellMaxShares] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/paper-trading');
      const data = await response.json();

      if (data.success) {
        setPortfolio(data.portfolio);
        setTrades(data.recentTrades);
        setMetrics(data.metrics);
      } else {
        setError(data.error || 'Failed to load portfolio');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTrade = async (ticker: string, type: 'buy' | 'sell', shares: number) => {
    setIsTrading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/paper-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, type, shares }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(
          `${type.toUpperCase()} ${shares} ${ticker} @ $${result.trade.price.toFixed(2)}`
        );
        setSellTicker(null);
        await fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Trade failed');
      }
    } catch (err) {
      setError('Failed to execute trade');
    } finally {
      setIsTrading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset your portfolio? All positions and history will be deleted.')) {
      return;
    }

    setIsResetting(true);
    setError(null);

    try {
      const response = await fetch('/api/paper-trading', { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage('Portfolio reset successfully');
        await fetchData();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Failed to reset');
      }
    } catch (err) {
      setError('Failed to reset portfolio');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSellClick = (ticker: string, maxShares: number) => {
    setSellTicker(ticker);
    setSellMaxShares(maxShares);
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
        <div className="flex items-center gap-3 mb-8">
          <Wallet className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Paper Trading</h1>
            <p className="text-text-secondary">
              Practice trading with $100,000 virtual money
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-negative/10 border border-negative/30 rounded-lg text-negative">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-positive/10 border border-positive/30 rounded-lg text-positive">
            {successMessage}
          </div>
        )}

        {portfolio && (
          <>
            {/* Portfolio Summary */}
            <div className="mb-8">
              <PortfolioSummary
                portfolio={portfolio}
                onReset={handleReset}
                isResetting={isResetting}
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Positions & Trades */}
              <div className="lg:col-span-2 space-y-8">
                <PositionsList positions={portfolio.positions} onSell={handleSellClick} />
                <TradeHistory trades={trades} />
              </div>

              {/* Right Column - Trade Form & Metrics */}
              <div className="space-y-6">
                <TradeForm
                  onTrade={handleTrade}
                  isTrading={isTrading}
                  availableCash={portfolio.currentCash}
                  defaultTicker={sellTicker || undefined}
                  defaultType={sellTicker ? 'sell' : 'buy'}
                  maxShares={sellTicker ? sellMaxShares : undefined}
                />
                {metrics && <PerformanceMetrics metrics={metrics} />}

                {/* Quick Buy from Predictions */}
                <div className="bg-surface rounded-lg border border-border p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <Link
                      href="/"
                      className="block px-4 py-2 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors text-center"
                    >
                      View Predictions to Trade
                    </Link>
                    <button
                      onClick={() => fetchData()}
                      className="w-full px-4 py-2 bg-background border border-border rounded hover:border-primary/50 transition-colors flex items-center justify-center gap-2 text-text-secondary"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Prices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>Paper Trading Disclaimer:</strong> This is a simulation using virtual money.
            No real trades are executed. Performance in paper trading does not guarantee similar
            results with real money. Always do your own research before trading.
          </p>
        </div>
      </div>
    </main>
  );
}

function Header() {
  return (
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
            <Link
              href="/paper-trading"
              className="text-text-primary hover:text-primary transition-colors"
            >
              Paper Trading
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
