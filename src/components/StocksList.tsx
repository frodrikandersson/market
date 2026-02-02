'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, TrendingUp, TrendingDown, Building2, X } from 'lucide-react';

interface Stock {
  ticker: string;
  name: string;
  sector: string | null;
  price: number;
  priceChange: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  impactScore: number;
}

interface StocksListProps {
  stocks: Stock[];
}

export function StocksList({ stocks }: StocksListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter stocks based on search query
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return stocks;

    const query = searchQuery.toLowerCase();
    return stocks.filter(
      (stock) =>
        stock.ticker.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.sector?.toLowerCase().includes(query)
    );
  }, [stocks, searchQuery]);

  // Group by sector
  const sectors = useMemo(() => {
    return filteredStocks.reduce((acc, stock) => {
      const sector = stock.sector || 'Other';
      if (!acc[sector]) acc[sector] = [];
      acc[sector].push(stock);
      return acc;
    }, {} as Record<string, Stock[]>);
  }, [filteredStocks]);

  // Get top 5 suggestions for autocomplete
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    return filteredStocks.slice(0, 5);
  }, [filteredStocks, searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleSelectStock = (ticker: string) => {
    setSearchQuery(ticker);
    setShowSuggestions(false);
  };

  return (
    <div>
      {/* Search Field */}
      <div className="relative mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Search by ticker, company name, or sector..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full pl-10 pr-10 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
            {suggestions.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => handleSelectStock(stock.ticker)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-background transition-colors text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">{stock.ticker}</span>
                    {stock.sentiment && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          stock.sentiment === 'positive'
                            ? 'bg-positive'
                            : stock.sentiment === 'negative'
                              ? 'bg-negative'
                              : 'bg-neutral'
                        }`}
                      />
                    )}
                  </div>
                  <p className="text-sm text-text-secondary truncate">{stock.name}</p>
                  {stock.sector && (
                    <p className="text-xs text-text-muted mt-0.5">{stock.sector}</p>
                  )}
                </div>
                {stock.price > 0 && (
                  <div className="text-right ml-4">
                    <div className="font-mono-numbers text-text-primary text-sm">
                      ${stock.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-xs font-mono-numbers ${
                        stock.priceChange >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {stock.priceChange >= 0 ? '+' : ''}
                      {stock.priceChange.toFixed(2)}%
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Count */}
      {searchQuery && (
        <div className="mb-6 text-text-secondary text-sm">
          Found {filteredStocks.length} stock{filteredStocks.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
        </div>
      )}

      {/* Stocks by Sector */}
      {Object.entries(sectors).map(([sector, sectorStocks]) => (
        <div key={sector} className="mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {sector}
            <span className="text-sm font-normal text-text-muted">({sectorStocks.length})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sectorStocks.map((stock) => (
              <Link
                key={stock.ticker}
                href={`/stock/${stock.ticker}`}
                className="bg-surface rounded-lg border border-border p-4 hover:border-primary/50 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-bold text-lg text-text-primary">{stock.ticker}</span>
                  {stock.sentiment && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        stock.sentiment === 'positive'
                          ? 'bg-positive'
                          : stock.sentiment === 'negative'
                            ? 'bg-negative'
                            : 'bg-neutral'
                      }`}
                    />
                  )}
                </div>
                <p className="text-sm text-text-secondary truncate mb-2">{stock.name}</p>
                {stock.price > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-mono-numbers text-text-primary">
                      ${stock.price.toFixed(2)}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-sm font-mono-numbers ${
                        stock.priceChange >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {stock.priceChange >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {stock.priceChange >= 0 ? '+' : ''}
                      {stock.priceChange.toFixed(2)}%
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* No Results */}
      {filteredStocks.length === 0 && searchQuery && (
        <div className="bg-surface rounded-lg border border-border p-8 text-center">
          <p className="text-text-secondary mb-2">No stocks found matching &quot;{searchQuery}&quot;</p>
          <p className="text-text-muted text-sm">
            Try searching by ticker symbol, company name, or sector
          </p>
        </div>
      )}

      {/* No Stocks at All */}
      {stocks.length === 0 && (
        <div className="bg-surface rounded-lg border border-border p-8 text-center">
          <p className="text-text-secondary mb-2">No companies tracked yet</p>
          <p className="text-text-muted text-sm">
            Run the seed script to populate companies:
          </p>
          <code className="text-xs text-primary mt-2 block">
            npx tsx scripts/seed-companies.ts
          </code>
        </div>
      )}
    </div>
  );
}
