import { ArrowLeft, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function StocksPage() {
  // Get all companies with their latest news impact and price data
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    include: {
      newsImpacts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      stockPrices: {
        orderBy: { date: 'desc' },
        take: 2,
      },
    },
    orderBy: { ticker: 'asc' },
  });

  // Process companies with price change
  const stocksData = companies.map((company) => {
    const latestPrice = company.stockPrices[0];
    const previousPrice = company.stockPrices[1];
    const priceChange = latestPrice && previousPrice
      ? ((latestPrice.close - previousPrice.close) / previousPrice.close) * 100
      : 0;
    const latestImpact = company.newsImpacts[0];

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      price: latestPrice?.close ?? 0,
      priceChange,
      sentiment: latestImpact?.sentiment as 'positive' | 'negative' | 'neutral' | undefined,
      impactScore: latestImpact?.impactScore ?? 0,
    };
  });

  // Group by sector
  const sectors = stocksData.reduce((acc, stock) => {
    const sector = stock.sector || 'Other';
    if (!acc[sector]) acc[sector] = [];
    acc[sector].push(stock);
    return acc;
  }, {} as Record<string, typeof stocksData>);

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
          <h1 className="text-3xl font-bold text-text-primary mb-2">All Stocks</h1>
          <p className="text-text-secondary">
            {companies.length} companies tracked across {Object.keys(sectors).length} sectors
          </p>
        </div>

        {/* Stocks by Sector */}
        {Object.entries(sectors).map(([sector, stocks]) => (
          <div key={sector} className="mb-8">
            <h2 className="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {sector}
              <span className="text-sm font-normal text-text-muted">({stocks.length})</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {stocks.map((stock) => (
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

        {companies.length === 0 && (
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

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-surface/50 rounded-lg border border-border">
          <p className="text-xs text-text-muted text-center">
            <strong>Disclaimer:</strong> This is not financial advice. Predictions are for
            educational and entertainment purposes only.
          </p>
        </div>
      </div>
    </main>
  );
}
