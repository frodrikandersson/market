import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { prisma } from '@/lib/db';
import { StocksList } from '@/components/StocksList';

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
            {companies.length} companies tracked
          </p>
        </div>

        {/* Stocks List with Search */}
        <StocksList stocks={stocksData} />

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
