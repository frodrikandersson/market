/**
 * Earnings Call & Reports Client
 * ================================
 * Fetches earnings call information and reports.
 * Currently disabled - Finnhub removed.
 * TODO: Integrate alternative earnings calendar API
 *
 * Usage:
 *   import { earnings } from '@/lib/earnings';
 *   const calls = await earnings.getUpcomingEarnings();
 */

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
  // DISABLED: Finnhub API removed
  console.log('[Earnings] Earnings calendar disabled - Finnhub API removed');
  return [];
}

/**
 * Get recent earnings releases (past week)
 */
export async function getRecentEarnings(daysBack: number = 7): Promise<NewsAPIArticle[]> {
  // DISABLED: Finnhub API removed
  console.log('[Earnings] Earnings calendar disabled - Finnhub API removed');
  return [];
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
  // DISABLED: Finnhub API removed
  return false;
}

// Export as namespace
export const earnings = {
  getUpcomingEarnings,
  getRecentEarnings,
  getAllEarnings,
  isAvailable,
};
