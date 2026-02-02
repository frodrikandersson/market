/**
 * Company Discovery Service
 * =========================
 * Auto-discovers and adds new companies from news/social mentions.
 *
 * When the news processor finds a ticker not in the database,
 * this service fetches company info and adds it automatically.
 *
 * Usage:
 *   import { companyDiscovery } from '@/services/company-discovery';
 *   const company = await companyDiscovery.discoverCompany('PLTR');
 */

import { db } from '@/lib/db';

// ===========================================
// Types
// ===========================================

export interface DiscoveredCompany {
  id: string;
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  isNew: boolean;
}

// Map Finnhub industries to our sector categories
const INDUSTRY_TO_SECTOR: Record<string, string> = {
  'Technology': 'Technology',
  'Software': 'Technology',
  'Semiconductors': 'Technology',
  'Hardware': 'Technology',
  'Internet': 'Technology',
  'Media': 'Technology',
  'Telecommunications': 'Technology',

  'Financial Services': 'Finance',
  'Banking': 'Finance',
  'Insurance': 'Finance',
  'Asset Management': 'Finance',

  'Healthcare': 'Healthcare',
  'Biotechnology': 'Healthcare',
  'Pharmaceuticals': 'Healthcare',
  'Medical Devices': 'Healthcare',

  'Consumer Cyclical': 'Consumer',
  'Consumer Defensive': 'Consumer',
  'Retail': 'Consumer',
  'Restaurants': 'Consumer',

  'Energy': 'Energy',
  'Oil & Gas': 'Energy',
  'Utilities': 'Energy',

  'Industrials': 'Industrial',
  'Aerospace': 'Industrial',
  'Defense': 'Industrial',
  'Manufacturing': 'Industrial',

  'Real Estate': 'Real Estate',
  'Basic Materials': 'Materials',
  'Communication Services': 'Communication',
};

/**
 * Map Finnhub industry to our sector
 */
function mapIndustryToSector(finnhubIndustry: string): string {
  // Check direct mapping
  if (INDUSTRY_TO_SECTOR[finnhubIndustry]) {
    return INDUSTRY_TO_SECTOR[finnhubIndustry];
  }

  // Check partial matches
  for (const [key, sector] of Object.entries(INDUSTRY_TO_SECTOR)) {
    if (finnhubIndustry.toLowerCase().includes(key.toLowerCase())) {
      return sector;
    }
  }

  return 'Other';
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Check if a company exists in the database
 */
export async function companyExists(ticker: string): Promise<boolean> {
  const company = await db.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: { id: true },
  });
  return !!company;
}

/**
 * Get company from database
 */
export async function getCompany(ticker: string) {
  return db.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
  });
}

/**
 * Discover and add a new company from ticker
 * Returns the company (existing or newly created)
 */
export async function discoverCompany(ticker: string): Promise<DiscoveredCompany | null> {
  const normalizedTicker = ticker.toUpperCase().replace('$', '');

  // Check if already exists
  const existing = await db.company.findUnique({
    where: { ticker: normalizedTicker },
  });

  if (existing) {
    return {
      id: existing.id,
      ticker: existing.ticker,
      name: existing.name,
      sector: existing.sector,
      industry: existing.industry,
      marketCap: existing.marketCap,
      isNew: false,
    };
  }

  // Create company with basic info (will be enriched later via stock price fetches)
  try {
    const company = await db.company.create({
      data: {
        ticker: normalizedTicker,
        name: normalizedTicker, // Will be updated later with actual name
        sector: null,
        industry: null,
        marketCap: null,
        isActive: true,
      },
    });

    console.log(`[Discovery] Added new company: ${company.ticker} (will fetch details later)`);

    return {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      marketCap: company.marketCap,
      isNew: true,
    };
  } catch (error) {
    console.error(`[Discovery] Failed to create company for ${normalizedTicker}:`, error);
    return null;
  }
}

/**
 * Discover multiple companies from a list of tickers
 * Returns discovered companies (skips failures)
 */
export async function discoverCompanies(tickers: string[]): Promise<DiscoveredCompany[]> {
  const results: DiscoveredCompany[] = [];
  const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase().replace('$', '')))];

  for (const ticker of uniqueTickers) {
    // Rate limit - 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));

    const company = await discoverCompany(ticker);
    if (company) {
      results.push(company);
    }
  }

  return results;
}

/**
 * Extract tickers from text (finds $TICKER patterns)
 */
export function extractTickers(text: string): string[] {
  // Match $TICKER pattern (1-5 uppercase letters)
  const tickerPattern = /\$([A-Z]{1,5})\b/g;
  const matches = text.match(tickerPattern) || [];

  // Also match standalone tickers that look like stock symbols
  // But be more careful to avoid false positives
  const standalonePattern = /\b([A-Z]{2,5})\b/g;
  const standaloneMatches = text.match(standalonePattern) || [];

  // Filter standalone to only likely tickers (exclude common words)
  const commonWords = new Set([
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
    'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW',
    'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'CEO', 'CFO', 'IPO', 'GDP', 'FDA',
    'SEC', 'ETF', 'NYSE', 'USA', 'USD', 'EUR', 'API', 'CEO', 'AI', 'ML',
  ]);

  const allTickers = [
    ...matches.map(m => m.replace('$', '')),
    ...standaloneMatches.filter(t => !commonWords.has(t) && t.length >= 2),
  ];

  return [...new Set(allTickers)];
}

/**
 * Discover companies mentioned in text
 */
export async function discoverFromText(text: string): Promise<DiscoveredCompany[]> {
  const tickers = extractTickers(text);
  if (tickers.length === 0) return [];

  return discoverCompanies(tickers);
}

// Export as namespace
export const companyDiscovery = {
  companyExists,
  getCompany,
  discoverCompany,
  discoverCompanies,
  extractTickers,
  discoverFromText,
};
