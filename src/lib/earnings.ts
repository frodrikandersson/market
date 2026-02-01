/**
 * Earnings Call & Reports Client
 * ================================
 * Fetches earnings call information and reports.
 * Uses Finnhub's free earnings calendar + SEC 8-K earnings releases.
 *
 * Sources:
 * - Finnhub Earnings Calendar (free tier)
 * - SEC 8-K Item 2.02 (earnings releases)
 *
 * Usage:
 *   import { earnings } from '@/lib/earnings';
 *   const calls = await earnings.getUpcomingEarnings();
 */

import { finnhub } from '@/lib/finnhub';
import type { NewsAPIArticle } from '@/types';

// ===========================================
// Types
// ===========================================

interface FinnhubEarning {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

interface EarningsSurprise {
  ticker: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprise: number | null; // Actual - Estimate
  surprisePercent: number | null; // (Actual - Estimate) / Estimate * 100
  beat: boolean | null; // Did it beat estimates?
}

// ===========================================
// Earnings Calendar
// ===========================================

/**
 * Get upcoming earnings calls
 */
export async function getUpcomingEarnings(daysAhead: number = 7): Promise<NewsAPIArticle[]> {
  try {
    const from = getDateDaysAgo(0); // Today
    const to = getDateDaysAgo(-daysAhead); // N days ahead

    console.log(`[Earnings] Fetching earnings from ${from} to ${to}`);

    // Finnhub provides earnings calendar
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    const earningsData: FinnhubEarning[] = data.earningsCalendar || [];

    console.log(`[Earnings] Found ${earningsData.length} upcoming earnings calls`);

    // Convert to news article format
    return earningsData.map((earning) => convertEarningToArticle(earning, 'upcoming'));
  } catch (error) {
    console.error('[Earnings] Error fetching upcoming earnings:', error);
    return [];
  }
}

/**
 * Get recent earnings releases (past week)
 */
export async function getRecentEarnings(daysBack: number = 7): Promise<NewsAPIArticle[]> {
  try {
    const from = getDateDaysAgo(daysBack);
    const to = getDateDaysAgo(0);

    console.log(`[Earnings] Fetching recent earnings from ${from} to ${to}`);

    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    const earningsData: FinnhubEarning[] = data.earningsCalendar || [];

    console.log(`[Earnings] Found ${earningsData.length} recent earnings releases`);

    // Filter only companies that have reported (epsActual is not null)
    const reported = earningsData.filter((e) => e.epsActual !== null);

    // Analyze for surprises
    const withSurprises = reported.map((earning) => {
      const surprise = calculateSurprise(earning);
      return { earning, surprise };
    });

    // Convert to news articles
    return withSurprises.map(({ earning, surprise }) =>
      convertEarningToArticle(earning, 'reported', surprise)
    );
  } catch (error) {
    console.error('[Earnings] Error fetching recent earnings:', error);
    return [];
  }
}

/**
 * Get all earnings (upcoming + recent)
 */
export async function getAllEarnings(): Promise<NewsAPIArticle[]> {
  try {
    console.log('[Earnings] Fetching all earnings data...');

    const [upcoming, recent] = await Promise.all([
      getUpcomingEarnings(7), // Next 7 days
      getRecentEarnings(3),    // Past 3 days
    ]);

    const all = [...recent, ...upcoming];
    console.log(`[Earnings] Total earnings: ${all.length} (${recent.length} recent, ${upcoming.length} upcoming)`);

    return all;
  } catch (error) {
    console.error('[Earnings] Error fetching all earnings:', error);
    return [];
  }
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Calculate earnings surprise
 */
function calculateSurprise(earning: FinnhubEarning): EarningsSurprise {
  const { symbol, date, epsActual, epsEstimate } = earning;

  if (epsActual === null || epsEstimate === null || epsEstimate === 0) {
    return {
      ticker: symbol,
      date,
      epsActual,
      epsEstimate,
      surprise: null,
      surprisePercent: null,
      beat: null,
    };
  }

  const surprise = epsActual - epsEstimate;
  const surprisePercent = (surprise / Math.abs(epsEstimate)) * 100;
  const beat = surprise > 0;

  return {
    ticker: symbol,
    date,
    epsActual,
    epsEstimate,
    surprise,
    surprisePercent,
    beat,
  };
}

/**
 * Convert Finnhub earning to NewsAPIArticle format
 */
function convertEarningToArticle(
  earning: FinnhubEarning,
  type: 'upcoming' | 'reported',
  surprise?: EarningsSurprise
): NewsAPIArticle {
  const { symbol, date, quarter, year, epsActual, epsEstimate, hour } = earning;

  let title = '';
  let description = '';
  let content = '';

  if (type === 'upcoming') {
    title = `${symbol} - Upcoming Earnings Call (Q${quarter} ${year})`;
    description = `${symbol} scheduled to report Q${quarter} ${year} earnings on ${date} ${hour}. Estimated EPS: $${epsEstimate?.toFixed(2) || 'N/A'}.`;
    content = description;
  } else {
    // Reported earnings
    const beatOrMiss = surprise?.beat ? '✅ BEAT' : surprise?.beat === false ? '❌ MISS' : 'INLINE';
    const surpriseText = surprise?.surprisePercent
      ? `${surprise.surprisePercent > 0 ? '+' : ''}${surprise.surprisePercent.toFixed(1)}%`
      : '';

    title = `${symbol} - Earnings Report ${beatOrMiss} (Q${quarter} ${year})`;
    description = `${symbol} reported Q${quarter} ${year} earnings: EPS $${epsActual?.toFixed(2)} vs. est. $${epsEstimate?.toFixed(2)} ${beatOrMiss} ${surpriseText}`;
    content = description;
  }

  return {
    source: {
      id: 'earnings',
      name: 'Earnings Calendar',
    },
    author: 'Finnhub',
    title,
    description,
    url: `https://finnhub.io/quote/${symbol}`,
    urlToImage: null,
    publishedAt: new Date(date).toISOString(),
    content,
  };
}

/**
 * Get date N days ago (or ahead if negative) in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Check if earnings API is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const from = getDateDaysAgo(0);
    const to = getDateDaysAgo(-1);
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Export as namespace
export const earnings = {
  getUpcomingEarnings,
  getRecentEarnings,
  getAllEarnings,
  isAvailable,
};
