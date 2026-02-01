/**
 * SEC EDGAR API Client
 * =====================
 * Fetches SEC filings (8-K, Form 4, etc.) for insider trading and material events.
 * Completely free, no API keys required!
 *
 * SEC EDGAR provides:
 * - 8-K: Material corporate events (M&A, executive changes, bankruptcy, etc.)
 * - Form 4: Insider trading (when executives/directors buy/sell stock)
 * - 10-Q/10-K: Quarterly/annual reports
 * - 13F: Institutional holdings (hedge fund positions)
 *
 * Rate Limits: 10 requests/second (very generous)
 *
 * Usage:
 *   import { secEdgar } from '@/lib/sec-edgar';
 *   const filings = await secEdgar.getRecent8KFilings();
 */

import type { NewsAPIArticle } from '@/types';

const SEC_BASE_URL = 'https://www.sec.gov';
const SEC_HEADERS = {
  'User-Agent': 'MarketPredictor/1.0 (educational project)',
  Accept: 'application/json',
};

// ===========================================
// Types
// ===========================================

interface SECFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  acceptanceDateTime: string;
  act: string;
  form: string;
  fileNumber: string;
  filmNumber: string;
  items: string;
  size: number;
  isXBRL: number;
  isInlineXBRL: number;
  primaryDocument: string;
  primaryDocDescription: string;
}

interface SECCompanyInfo {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  insiderTransactionForOwnerExists: number;
  insiderTransactionForIssuerExists: number;
  name: string;
  tickers: string[];
  exchanges: string[];
  ein: string;
  description: string;
  website: string;
  investorWebsite: string;
  category: string;
  fiscalYearEnd: string;
  stateOfIncorporation: string;
  stateOfIncorporationDescription: string;
  addresses: {
    mailing: Address;
    business: Address;
  };
  phone: string;
  flags: string;
  formerNames: FormerName[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      act: string[];
      form: string[];
      fileNumber: string[];
      filmNumber: string[];
      items: string[];
      size: number[];
      isXBRL: number[];
      isInlineXBRL: number[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
    files: Array<{
      name: string;
      filingCount: number;
      filingFrom: string;
      filingTo: string;
    }>;
  };
}

interface Address {
  street1: string;
  street2: string | null;
  city: string;
  stateOrCountry: string;
  zipCode: string;
  stateOrCountryDescription: string;
}

interface FormerName {
  name: string;
  from: string;
  to: string;
}

// SEC RSS Feed format
interface SECRSSFeed {
  entries: Array<{
    title: string;
    link: string;
    summary: string;
    updated: string;
    category: {
      term: string;
      label: string;
    };
  }>;
}

// Ticker to CIK mapping (we'll build this dynamically)
const tickerToCIK = new Map<string, string>();

// ===========================================
// CIK Lookup
// ===========================================

/**
 * Get CIK (Central Index Key) for a ticker symbol
 * SEC uses CIK instead of tickers
 */
export async function getCIKForTicker(ticker: string): Promise<string | null> {
  // Check cache first
  if (tickerToCIK.has(ticker)) {
    return tickerToCIK.get(ticker)!;
  }

  try {
    // Use SEC's company tickers JSON
    const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: SEC_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const data = await response.json();

    // Find ticker in the list
    for (const key in data) {
      const company = data[key];
      if (company.ticker === ticker) {
        const cik = company.cik_str.toString().padStart(10, '0');
        tickerToCIK.set(ticker, cik);
        return cik;
      }
    }

    console.log(`[SEC] CIK not found for ticker: ${ticker}`);
    return null;
  } catch (error) {
    console.error(`[SEC] Error looking up CIK for ${ticker}:`, error);
    return null;
  }
}

// ===========================================
// 8-K Filings (Material Events)
// ===========================================

/**
 * Get recent 8-K filings (material corporate events)
 * 8-K filings report major events like:
 * - Item 1.01: Entry into Material Agreement
 * - Item 1.02: Termination of Material Agreement
 * - Item 2.01: Completion of Acquisition or Disposition
 * - Item 5.02: Departure/Election of Directors or Officers
 * - Item 7.01: Regulation FD Disclosure
 * - Item 8.01: Other Events
 */
export async function getRecent8KFilings(limit: number = 100): Promise<NewsAPIArticle[]> {
  try {
    const url = `${SEC_BASE_URL}/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=8-K&company=&dateb=&owner=exclude&start=0&count=${limit}&output=atom`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': SEC_HEADERS['User-Agent'],
        Accept: 'application/atom+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const xmlText = await response.text();
    return parse8KFeed(xmlText);
  } catch (error) {
    console.error('[SEC] Error fetching 8-K filings:', error);
    return [];
  }
}

/**
 * Parse SEC Atom feed to extract 8-K filings
 */
function parse8KFeed(xmlText: string): NewsAPIArticle[] {
  const articles: NewsAPIArticle[] = [];

  try {
    // Extract all <entry> elements (Atom format)
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    const entries = xmlText.match(entryRegex) || [];

    for (const entryXml of entries) {
      const article = parse8KEntry(entryXml);
      if (article) {
        articles.push(article);
      }
    }

    console.log(`[SEC] Parsed ${articles.length} 8-K filings`);
  } catch (error) {
    console.error('[SEC] Error parsing 8-K feed:', error);
  }

  return articles;
}

/**
 * Parse a single 8-K filing entry
 */
function parse8KEntry(entryXml: string): NewsAPIArticle | null {
  try {
    // Extract fields from Atom XML
    const extractTag = (tag: string): string | null => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = entryXml.match(regex);
      return match ? match[1].trim() : null;
    };

    const title = extractTag('title');
    const link = extractTag('link');
    const summary = extractTag('summary');
    const updated = extractTag('updated');

    if (!title || !link) {
      return null;
    }

    // Extract company name and form type from title
    // Format: "8-K - APPLE INC (0000320193) (Filer)"
    const companyMatch = title.match(/8-K\s*-\s*(.+?)\s*\(/);
    const companyName = companyMatch ? companyMatch[1].trim() : 'Unknown Company';

    // Extract CIK from title
    const cikMatch = title.match(/\((\d{10})\)/);
    const cik = cikMatch ? cikMatch[1] : null;

    // Enhance description with filing type
    const description = `SEC 8-K Filing: ${companyName}. ${summary || 'Material corporate event disclosed.'}`;

    // Extract link URL (Atom uses href attribute)
    const linkMatch = link.match(/href="([^"]+)"/);
    const url = linkMatch ? linkMatch[1] : link;

    return {
      source: {
        id: 'sec-edgar',
        name: 'SEC EDGAR',
      },
      author: 'SEC',
      title: `${companyName} - 8-K Filing`,
      description,
      url: url.startsWith('http') ? url : `${SEC_BASE_URL}${url}`,
      urlToImage: null,
      publishedAt: updated ? new Date(updated).toISOString() : new Date().toISOString(),
      content: description,
    };
  } catch (error) {
    console.error('[SEC] Error parsing 8-K entry:', error);
    return null;
  }
}

// ===========================================
// Form 4 (Insider Trading)
// ===========================================

/**
 * Get recent Form 4 filings (insider trading)
 * Form 4 reports when company insiders (execs, directors, 10%+ owners) buy/sell stock
 */
export async function getRecentForm4Filings(limit: number = 100): Promise<NewsAPIArticle[]> {
  try {
    const url = `${SEC_BASE_URL}/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=4&company=&dateb=&owner=include&start=0&count=${limit}&output=atom`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': SEC_HEADERS['User-Agent'],
        Accept: 'application/atom+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const xmlText = await response.text();
    return parseForm4Feed(xmlText);
  } catch (error) {
    console.error('[SEC] Error fetching Form 4 filings:', error);
    return [];
  }
}

/**
 * Parse Form 4 feed
 */
function parseForm4Feed(xmlText: string): NewsAPIArticle[] {
  const articles: NewsAPIArticle[] = [];

  try {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    const entries = xmlText.match(entryRegex) || [];

    for (const entryXml of entries) {
      const article = parseForm4Entry(entryXml);
      if (article) {
        articles.push(article);
      }
    }

    console.log(`[SEC] Parsed ${articles.length} Form 4 filings`);
  } catch (error) {
    console.error('[SEC] Error parsing Form 4 feed:', error);
  }

  return articles;
}

/**
 * Parse a single Form 4 entry
 */
function parseForm4Entry(entryXml: string): NewsAPIArticle | null {
  try {
    const extractTag = (tag: string): string | null => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = entryXml.match(regex);
      return match ? match[1].trim() : null;
    };

    const title = extractTag('title');
    const link = extractTag('link');
    const summary = extractTag('summary');
    const updated = extractTag('updated');

    if (!title || !link) {
      return null;
    }

    // Extract insider name and company
    // Format: "4 - SMITH JOHN (Insider) at APPLE INC (0000320193)"
    const insiderMatch = title.match(/4\s*-\s*(.+?)\s*\(Insider\)\s*at\s*(.+?)\s*\(/);
    const insiderName = insiderMatch ? insiderMatch[1].trim() : 'Unknown Insider';
    const companyName = insiderMatch ? insiderMatch[2].trim() : 'Unknown Company';

    // Determine if it's a buy or sell (we'd need to parse the actual XML for this)
    // For now, just report as insider transaction
    const description = `Insider Trading Alert: ${insiderName} filed Form 4 for ${companyName}. ${summary || 'Insider transaction reported.'}`;

    const linkMatch = link.match(/href="([^"]+)"/);
    const url = linkMatch ? linkMatch[1] : link;

    return {
      source: {
        id: 'sec-edgar',
        name: 'SEC EDGAR',
      },
      author: 'SEC',
      title: `${companyName} - Insider Trading (${insiderName})`,
      description,
      url: url.startsWith('http') ? url : `${SEC_BASE_URL}${url}`,
      urlToImage: null,
      publishedAt: updated ? new Date(updated).toISOString() : new Date().toISOString(),
      content: description,
    };
  } catch (error) {
    console.error('[SEC] Error parsing Form 4 entry:', error);
    return null;
  }
}

// ===========================================
// Company-Specific Filings
// ===========================================

/**
 * Get all recent filings for a specific company by ticker
 */
export async function getCompanyFilings(
  ticker: string,
  formType?: '8-K' | '10-Q' | '10-K' | '4'
): Promise<NewsAPIArticle[]> {
  try {
    const cik = await getCIKForTicker(ticker);
    if (!cik) {
      console.log(`[SEC] Could not find CIK for ticker: ${ticker}`);
      return [];
    }

    // Fetch company submission data
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const response = await fetch(url, {
      headers: SEC_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const data: SECCompanyInfo = await response.json();

    // Filter by form type if specified
    const recentFilings = data.filings.recent;
    const articles: NewsAPIArticle[] = [];

    for (let i = 0; i < recentFilings.form.length; i++) {
      const form = recentFilings.form[i];

      if (formType && form !== formType) {
        continue;
      }

      // Only process important forms
      if (!['8-K', '10-Q', '10-K', '4'].includes(form)) {
        continue;
      }

      const filingDate = recentFilings.filingDate[i];
      const accessionNumber = recentFilings.accessionNumber[i];
      const primaryDoc = recentFilings.primaryDocument[i];

      // Build filing URL
      const filingUrl = `${SEC_BASE_URL}/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionNumber.replace(/-/g, '')}/${primaryDoc}`;

      articles.push({
        source: {
          id: 'sec-edgar',
          name: 'SEC EDGAR',
        },
        author: 'SEC',
        title: `${data.name} - ${form} Filing`,
        description: `SEC ${form} filing for ${data.name} (${ticker})`,
        url: filingUrl,
        urlToImage: null,
        publishedAt: new Date(filingDate).toISOString(),
        content: `SEC ${form} filing for ${data.name}`,
      });
    }

    console.log(`[SEC] Found ${articles.length} ${formType || 'all'} filings for ${ticker}`);
    return articles.slice(0, 10); // Return most recent 10
  } catch (error) {
    console.error(`[SEC] Error fetching filings for ${ticker}:`, error);
    return [];
  }
}

// ===========================================
// Combined Feed
// ===========================================

/**
 * Get all recent SEC filings (8-K + Form 4)
 */
export async function getAllRecentFilings(limit: number = 50): Promise<NewsAPIArticle[]> {
  try {
    console.log('[SEC] Fetching recent filings...');

    // Fetch both 8-K and Form 4 in parallel
    const [filings8K, filingsForm4] = await Promise.all([
      getRecent8KFilings(limit),
      getRecentForm4Filings(limit),
    ]);

    const allFilings = [...filings8K, ...filingsForm4];

    // Sort by published date (most recent first)
    allFilings.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    console.log(`[SEC] Total filings: ${allFilings.length} (${filings8K.length} 8-K, ${filingsForm4.length} Form 4)`);
    return allFilings.slice(0, limit);
  } catch (error) {
    console.error('[SEC] Error fetching all filings:', error);
    return [];
  }
}

/**
 * Check if SEC EDGAR API is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: SEC_HEADERS,
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Export as namespace
export const secEdgar = {
  getCIKForTicker,
  getRecent8KFilings,
  getRecentForm4Filings,
  getCompanyFilings,
  getAllRecentFilings,
  isAvailable,
};
