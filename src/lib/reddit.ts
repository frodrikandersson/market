/**
 * Reddit API Client
 * =================
 * Fetches posts from finance-related subreddits for the Hype Model.
 * Uses Reddit's public JSON API (no OAuth required for read-only).
 *
 * Supported subreddits:
 * - r/wallstreetbets (retail sentiment, meme stocks)
 * - r/stocks (general stock discussion)
 * - r/investing (long-term investing)
 * - r/options (options trading)
 *
 * Usage:
 *   import { reddit } from '@/lib/reddit';
 *   const posts = await reddit.fetchAllSubreddits();
 */

// Subreddit configurations with weights (EXPANDED: 15 → 33 subreddits)
export const SUBREDDIT_CONFIG = {
  // Original 4 - High Volume
  wallstreetbets: { name: 'r/WallStreetBets', weight: 0.8, skipFlairs: ['Daily Discussion', 'Weekend Discussion'] },
  stocks: { name: 'r/stocks', weight: 0.7, skipFlairs: ['Rate My Portfolio', 'Advice Request'] },
  investing: { name: 'r/investing', weight: 0.6, skipFlairs: ['Daily Discussion'] },
  options: { name: 'r/options', weight: 0.7, skipFlairs: ['Daily Discussion'] },

  // Active Trading - High Activity
  Daytrading: { name: 'r/Daytrading', weight: 0.75, skipFlairs: ['Daily Discussion'] },
  SwingTrading: { name: 'r/SwingTrading', weight: 0.7, skipFlairs: [] },
  pennystocks: { name: 'r/pennystocks', weight: 0.6, skipFlairs: ['Daily Discussion'] },
  StockMarket: { name: 'r/StockMarket', weight: 0.7, skipFlairs: ['Daily Discussion', 'Advice'] },

  // Value & Strategy Focused
  ValueInvesting: { name: 'r/ValueInvesting', weight: 0.65, skipFlairs: [] },
  Dividends: { name: 'r/Dividends', weight: 0.65, skipFlairs: ['Rate My Portfolio'] },
  Bogleheads: { name: 'r/Bogleheads', weight: 0.6, skipFlairs: [] },

  // Sector-Specific
  TechStocks: { name: 'r/TechStocks', weight: 0.7, skipFlairs: [] },
  Semiconductors: { name: 'r/Semiconductors', weight: 0.7, skipFlairs: [] },
  electricvehicles: { name: 'r/electricvehicles', weight: 0.7, skipFlairs: ['Meme'] },
  Biotechplays: { name: 'r/Biotechplays', weight: 0.65, skipFlairs: [] },

  // === NEW ADDITIONS (+18 subreddits) ===

  // High-Activity Trading (100K+ members)
  SPACs: { name: 'r/SPACs', weight: 0.65, skipFlairs: ['Daily Discussion'] },
  thetagang: { name: 'r/thetagang', weight: 0.7, skipFlairs: ['Daily Thread'] },
  OptionsMillionaire: { name: 'r/OptionsMillionaire', weight: 0.65, skipFlairs: [] },
  smallstreetbets: { name: 'r/smallstreetbets', weight: 0.7, skipFlairs: ['Daily Discussion'] },

  // Stock-Specific Communities
  teslainvestorsclub: { name: 'r/teslainvestorsclub', weight: 0.75, skipFlairs: ['Daily Thread'] },
  AMD_Stock: { name: 'r/AMD_Stock', weight: 0.7, skipFlairs: [] },
  NVDA_Stock: { name: 'r/NVDA_Stock', weight: 0.7, skipFlairs: [] },
  PLTR: { name: 'r/PLTR', weight: 0.65, skipFlairs: [] },

  // Meme Stock Tracking (high retail sentiment)
  GME: { name: 'r/GME', weight: 0.6, skipFlairs: [] },
  amcstock: { name: 'r/amcstock', weight: 0.6, skipFlairs: [] },

  // Analysis & Research
  SecurityAnalysis: { name: 'r/SecurityAnalysis', weight: 0.75, skipFlairs: [] },
  FundamentalAnalysis: { name: 'r/FundamentalAnalysis', weight: 0.7, skipFlairs: [] },
  EducatedInvesting: { name: 'r/EducatedInvesting', weight: 0.7, skipFlairs: [] },

  // Crypto-Adjacent (affects tech stocks)
  CryptoCurrency: { name: 'r/CryptoCurrency', weight: 0.65, skipFlairs: ['Daily Discussion'] },
  Bitcoin: { name: 'r/Bitcoin', weight: 0.6, skipFlairs: ['Daily Discussion'] },
  ethereum: { name: 'r/ethereum', weight: 0.6, skipFlairs: ['Daily Discussion'] },

  // International Markets
  UKInvesting: { name: 'r/UKInvesting', weight: 0.6, skipFlairs: [] },
  CanadianInvestor: { name: 'r/CanadianInvestor', weight: 0.6, skipFlairs: [] },
} as const;

export type SubredditName = keyof typeof SUBREDDIT_CONFIG;

// Types for Reddit API responses
interface RedditAPIPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number; // upvotes - downvotes
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  link_flair_text: string | null;
  is_self: boolean;
  url: string;
}

interface RedditAPIListing {
  kind: string;
  data: {
    after: string | null;
    before: string | null;
    children: Array<{
      kind: string;
      data: RedditAPIPost;
    }>;
  };
}

export interface RedditPost {
  id: string;
  subreddit: SubredditName;
  title: string;
  content: string;
  author: string;
  score: number;
  upvoteRatio: number;
  commentCount: number;
  createdAt: Date;
  permalink: string;
  flair: string | null;
  tickers: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

// Alias for backwards compatibility
export type WSBPost = RedditPost;

// Common WSB terminology for sentiment detection
const WSB_BULLISH_TERMS = [
  'moon',
  'mooning',
  'rocket',
  '🚀',
  'tendies',
  'diamond hands',
  '💎',
  '🙌',
  'calls',
  'yolo',
  'bullish',
  'buy',
  'long',
  'squeeze',
  'gamma',
  'apes',
  'to the moon',
  'holding',
  'hodl',
  'gains',
  'green',
  'print',
  'printing',
  'free money',
];

const WSB_BEARISH_TERMS = [
  'puts',
  'short',
  'bearish',
  'sell',
  'dump',
  'crash',
  'tank',
  'red',
  'loss',
  'losses',
  'paper hands',
  '📉',
  'bag holder',
  'bagholding',
  'rip',
  'dead',
  'drill',
  'drilling',
  'rug pull',
  'scam',
  'overvalued',
];

// Relevant post flairs to filter for
const RELEVANT_FLAIRS = [
  'DD', // Due Diligence
  'Discussion',
  'YOLO',
  'Gain',
  'Loss',
  'Chart',
  'Technical Analysis',
  'Catalyst',
  'News',
  'Earnings Thread',
  null, // Include unflaired posts
];

/**
 * Extract stock tickers from text
 * WSB uses $TICKER format and also mentions tickers directly
 */
function extractTickers(text: string): string[] {
  const tickers = new Set<string>();

  // Match $TICKER format (most common on WSB)
  const cashtagMatches = text.match(/\$([A-Z]{1,5})\b/g) || [];
  for (const match of cashtagMatches) {
    tickers.add(match.slice(1));
  }

  // Match standalone tickers (2-5 uppercase letters, not common words)
  const commonWords = new Set([
    'I',
    'A',
    'THE',
    'AND',
    'OR',
    'FOR',
    'TO',
    'IN',
    'ON',
    'AT',
    'BY',
    'IS',
    'IT',
    'OF',
    'BE',
    'AS',
    'SO',
    'IF',
    'AN',
    'UP',
    'DD',
    'CEO',
    'CFO',
    'IPO',
    'ATH',
    'ATL',
    'EOD',
    'EOW',
    'PM',
    'AM',
    'EPS',
    'PE',
    'IV',
    'OTM',
    'ITM',
    'ATM',
    'DTE',
    'FD',
    'WSB',
    'SEC',
    'FED',
    'GDP',
    'CPI',
    'PPI',
    'FOMC',
    'IMO',
    'FOMO',
    'USA',
    'LLC',
    'INC',
    'ETF',
    'SPAC',
    'LOL',
    'WTF',
    'OMG',
    'LMAO',
    'TLDR',
    'TL',
    'DR',
    'EDIT',
    'UPDATE',
  ]);

  // Look for ticker patterns in context (e.g., "buying AAPL", "TSLA calls")
  const tickerContextRegex = /\b([A-Z]{2,5})\s+(calls?|puts?|shares?|stock|options?|moon|squeeze)/gi;
  let match;
  while ((match = tickerContextRegex.exec(text)) !== null) {
    const ticker = match[1].toUpperCase();
    if (!commonWords.has(ticker)) {
      tickers.add(ticker);
    }
  }

  // Match common company tickers mentioned by name
  const companyPatterns: [RegExp, string][] = [
    // FAANG+ / Mega caps
    [/\bapple\b/i, 'AAPL'],
    [/\btesla\b/i, 'TSLA'],
    [/\bmicrosoft\b/i, 'MSFT'],
    [/\bamazon\b/i, 'AMZN'],
    [/\bgoogle\b|\balphabet\b|\bwaymo\b/i, 'GOOGL'],
    [/\bmeta\b(?!\s*verse)|\bfacebook\b|\binstagram\b|\bwhatsapp\b/i, 'META'],
    [/\bnvidia\b/i, 'NVDA'],
    [/\bnetflix\b/i, 'NFLX'],

    // Semiconductors
    [/\bamd\b/i, 'AMD'],
    [/\bintel\b/i, 'INTC'],
    [/\bbroadcom\b/i, 'AVGO'],
    [/\bqualcomm\b/i, 'QCOM'],
    [/\bmicron\b/i, 'MU'],
    [/\barm\s+holdings\b|\barm\b(?=.*chip|.*stock|.*ipo)/i, 'ARM'],
    [/\basml\b/i, 'ASML'],
    [/\btaiwan\s+semi|tsmc\b/i, 'TSM'],

    // Meme stocks / WSB favorites
    [/\bgamestop\b/i, 'GME'],
    [/\bamc\b(?!.*network)/i, 'AMC'],
    [/\bpalantir\b/i, 'PLTR'],
    [/\bblackberry\b/i, 'BB'],
    [/\bnokia\b/i, 'NOK'],
    [/\bbed\s*bath\b/i, 'BBBY'],

    // Enterprise / Cloud
    [/\boracle\b/i, 'ORCL'],
    [/\bsalesforce\b/i, 'CRM'],
    [/\bsnowflake\b/i, 'SNOW'],
    [/\bservicenow\b/i, 'NOW'],
    [/\bworkday\b/i, 'WDAY'],
    [/\bdatdog\b|\bdatadog\b/i, 'DDOG'],
    [/\bcrowdstrike\b/i, 'CRWD'],
    [/\bpalo\s*alto\b/i, 'PANW'],
    [/\bcloud\s*flare\b/i, 'NET'],
    [/\btwilio\b/i, 'TWLO'],
    [/\bmongodb\b/i, 'MDB'],

    // Fintech / Payments
    [/\bcoinbase\b/i, 'COIN'],
    [/\brobinhood\b/i, 'HOOD'],
    [/\bsofi\b/i, 'SOFI'],
    [/\bpaypal\b/i, 'PYPL'],
    [/\bsquare\b|\bblock\s+inc/i, 'SQ'],
    [/\bstripe\b/i, 'STRIPE'], // Private but often discussed
    [/\baffirm\b/i, 'AFRM'],
    [/\bupstart\b/i, 'UPST'],
    [/\bvisa\b/i, 'V'],
    [/\bmastercard\b/i, 'MA'],

    // EV / Auto
    [/\brivian\b/i, 'RIVN'],
    [/\blucid\b/i, 'LCID'],
    [/\bford\b/i, 'F'],
    [/\bgeneral\s*motors\b|\bgm\b(?=.*stock|.*ev|.*car)/i, 'GM'],
    [/\bnio\b/i, 'NIO'],
    [/\bxpeng\b/i, 'XPEV'],
    [/\bli\s*auto\b/i, 'LI'],

    // E-commerce / Consumer
    [/\bshopify\b/i, 'SHOP'],
    [/\betsy\b/i, 'ETSY'],
    [/\bwayfair\b/i, 'W'],
    [/\bchewy\b/i, 'CHWY'],
    [/\bwalmart\b/i, 'WMT'],
    [/\btarget\b(?=.*stock|.*retail|.*earn)/i, 'TGT'],
    [/\bcostco\b/i, 'COST'],

    // Streaming / Entertainment
    [/\bdisney\b/i, 'DIS'],
    [/\bspotify\b/i, 'SPOT'],
    [/\broku\b/i, 'ROKU'],
    [/\bwarner\s*bros\b/i, 'WBD'],
    [/\bparamount\b/i, 'PARA'],

    // Travel / Gig economy
    [/\bairbnb\b/i, 'ABNB'],
    [/\bdoordash\b/i, 'DASH'],
    [/\buber\b/i, 'UBER'],
    [/\blyft\b/i, 'LYFT'],
    [/\bbooking\b/i, 'BKNG'],
    [/\bexpedia\b/i, 'EXPE'],

    // Social / Communication
    [/\bzoom\b/i, 'ZM'],
    [/\bsnap\b|\bsnapchat\b/i, 'SNAP'],
    [/\bpinterest\b/i, 'PINS'],
    [/\breddit\b/i, 'RDDT'],
    [/\bdiscord\b/i, 'DISCORD'], // Private but discussed

    // Biotech / Pharma
    [/\bpfizer\b/i, 'PFE'],
    [/\bmoderna\b/i, 'MRNA'],
    [/\bjohnson\s*&?\s*johnson\b/i, 'JNJ'],
    [/\bmerck\b/i, 'MRK'],
    [/\beli\s*lilly\b|\blilly\b/i, 'LLY'],
    [/\babbvie\b/i, 'ABBV'],
    [/\bnovo\s*nordisk\b|\bozempic\b|\bwegovy\b/i, 'NVO'],

    // Banks / Finance
    [/\bjpmorgan\b|\bjp\s*morgan\b|\bchase\b/i, 'JPM'],
    [/\bbank\s*of\s*america\b/i, 'BAC'],
    [/\bgoldman\s*sachs\b/i, 'GS'],
    [/\bmorgan\s*stanley\b/i, 'MS'],
    [/\bwells\s*fargo\b/i, 'WFC'],
    [/\bciti\b|\bcitigroup\b|\bcitibank\b/i, 'C'],
    [/\bcharles\s*schwab\b|\bschwab\b/i, 'SCHW'],

    // Energy
    [/\bexxon\b/i, 'XOM'],
    [/\bchevron\b/i, 'CVX'],
    [/\bshell\b(?=.*stock|.*oil|.*energy)/i, 'SHEL'],
    [/\bbp\b(?=.*stock|.*oil|.*energy)/i, 'BP'],

    // Crypto-related
    [/\bmicrostrategy\b/i, 'MSTR'],
    [/\bmarathon\s*digital\b/i, 'MARA'],
    [/\briot\s*(platforms|blockchain)\b/i, 'RIOT'],

    // AI / Tech misc
    [/\bc3\.?ai\b/i, 'AI'],
    [/\bpalantir\b/i, 'PLTR'],
    [/\bsoundcloud\b/i, 'SOUND'],
    [/\bunity\b(?=.*stock|.*game)/i, 'U'],

    // Aerospace / Defense
    [/\bboeing\b/i, 'BA'],
    [/\blockheed\b/i, 'LMT'],
    [/\braytheon\b/i, 'RTX'],
    [/\bnorthrop\b/i, 'NOC'],

    // ETFs
    [/\bspy\b|\bs&?p\s*500\b/i, 'SPY'],
    [/\bqqq\b|\bnasdaq\s*100\b/i, 'QQQ'],
    [/\biwm\b|\brussell\s*2000\b/i, 'IWM'],
    [/\bdia\b|\bdow\s*jones\b/i, 'DIA'],
    [/\btqqq\b/i, 'TQQQ'],
    [/\bsqqq\b/i, 'SQQQ'],
    [/\barkk\b|\bark\s*invest/i, 'ARKK'],
    [/\bsoxx\b/i, 'SOXX'],
    [/\bsmh\b/i, 'SMH'],
  ];

  for (const [pattern, ticker] of companyPatterns) {
    if (pattern.test(text)) {
      tickers.add(ticker);
    }
  }

  return Array.from(tickers);
}

/**
 * Detect sentiment from WSB-style text
 */
function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();

  let bullishScore = 0;
  let bearishScore = 0;

  for (const term of WSB_BULLISH_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      bullishScore++;
    }
  }

  for (const term of WSB_BEARISH_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      bearishScore++;
    }
  }

  // Check for rocket emojis (very bullish on WSB)
  const rocketCount = (text.match(/🚀/g) || []).length;
  bullishScore += rocketCount * 2;

  // Also check post score - highly upvoted posts tend to be bullish sentiment
  // (This is handled in the calling function)

  if (bullishScore > bearishScore + 1) return 'positive';
  if (bearishScore > bullishScore + 1) return 'negative';
  return 'neutral';
}

/**
 * Fetch posts from a subreddit
 */
async function fetchSubreddit(
  subreddit: SubredditName,
  sortBy: 'hot' | 'new' | 'top' | 'rising' = 'hot',
  limit: number = 50
): Promise<RedditPost[]> {
  const config = SUBREDDIT_CONFIG[subreddit];
  const url = `https://www.reddit.com/r/${subreddit}/${sortBy}.json?limit=${limit}&raw_json=1`;

  console.log(`[Reddit] Fetching r/${subreddit}/${sortBy}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'MarketPredictor/1.0 (by /u/market_predictor_bot)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  const data: RedditAPIListing = await response.json();

  const posts: RedditPost[] = [];

  for (const child of data.data.children) {
    const post = child.data;

    // Skip posts with certain flairs based on subreddit config
    if (post.link_flair_text && (config.skipFlairs as readonly string[]).includes(post.link_flair_text)) {
      continue;
    }

    // Combine title and selftext for analysis
    const fullText = `${post.title}\n\n${post.selftext || ''}`;

    // Extract tickers
    const tickers = extractTickers(fullText);

    // Only include posts that mention at least one ticker
    if (tickers.length === 0) {
      continue;
    }

    // Detect sentiment
    let sentiment = detectSentiment(fullText);

    // Boost positive sentiment for highly upvoted posts (varies by subreddit)
    const upvoteThreshold = subreddit === 'wallstreetbets' ? 1000 : 500;
    if (post.score > upvoteThreshold && sentiment === 'neutral') {
      sentiment = 'positive';
    }

    posts.push({
      id: `${subreddit}_${post.id}`, // Prefix with subreddit for uniqueness
      subreddit,
      title: post.title,
      content: post.selftext?.substring(0, 2000) || '', // Limit content length
      author: post.author,
      score: post.score,
      upvoteRatio: post.upvote_ratio,
      commentCount: post.num_comments,
      createdAt: new Date(post.created_utc * 1000),
      permalink: `https://reddit.com${post.permalink}`,
      flair: post.link_flair_text,
      tickers,
      sentiment,
    });
  }

  console.log(`[Reddit] r/${subreddit}: Found ${posts.length} posts with ticker mentions from ${data.data.children.length} total`);

  return posts;
}

/**
 * Fetch from a single subreddit with multiple sort types
 */
async function fetchFromSubreddit(subreddit: SubredditName, limit: number = 30): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];
  const seenIds = new Set<string>();

  // Fetch from hot (30), new (30), and rising (20) to maximize coverage
  const sortTypes: Array<{ type: 'hot' | 'new' | 'rising'; limit: number }> = [
    { type: 'hot', limit: 30 },
    { type: 'new', limit: 30 },
    { type: 'rising', limit: 20 },
  ];

  for (const { type: sortType, limit: sortLimit } of sortTypes) {
    try {
      const posts = await fetchSubreddit(subreddit, sortType, sortLimit);

      for (const post of posts) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          allPosts.push(post);
        }
      }

      // Rate limit between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Reddit] Error fetching r/${subreddit}/${sortType}:`, error);
    }
  }

  console.log(`[Reddit] r/${subreddit}: Fetched ${allPosts.length} unique posts across all sort types`);
  return allPosts;
}

/**
 * Fetch from all configured subreddits
 */
async function fetchAllSubreddits(limit: number = 20): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];
  const subreddits = Object.keys(SUBREDDIT_CONFIG) as SubredditName[];

  console.log(`[Reddit] Fetching from ${subreddits.length} subreddits...`);

  for (const subreddit of subreddits) {
    try {
      const posts = await fetchFromSubreddit(subreddit, limit);
      allPosts.push(...posts);

      // Rate limit between subreddits
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`[Reddit] Error fetching r/${subreddit}:`, error);
    }
  }

  console.log(`[Reddit] Total posts from all subreddits: ${allPosts.length}`);

  return allPosts;
}

/**
 * Backwards compatible: Fetch from WSB only
 */
async function fetchAllWSB(limit: number = 25): Promise<RedditPost[]> {
  return fetchFromSubreddit('wallstreetbets', limit);
}

/**
 * Check if Reddit API is accessible
 */
async function isAvailable(): Promise<boolean> {
  try {
    const response = await fetch('https://www.reddit.com/r/wallstreetbets/about.json', {
      headers: {
        'User-Agent': 'MarketPredictor/1.0',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Calculate engagement score for a post (0-1 normalized)
 * WSB engagement is different - high scores and comment counts matter
 */
function calculateEngagement(post: RedditPost): number {
  // Weights: upvotes matter most, then comments
  const scoreWeight = Math.min(1, post.score / 10000); // Cap at 10k
  const commentWeight = Math.min(1, post.commentCount / 1000); // Cap at 1k
  const ratioWeight = post.upvoteRatio; // Already 0-1

  // Combined score
  return scoreWeight * 0.5 + commentWeight * 0.3 + ratioWeight * 0.2;
}

/**
 * Get subreddit display name
 */
function getSubredditName(subreddit: SubredditName): string {
  return SUBREDDIT_CONFIG[subreddit].name;
}

/**
 * Get subreddit weight for scoring
 */
function getSubredditWeight(subreddit: SubredditName): number {
  return SUBREDDIT_CONFIG[subreddit].weight;
}

// Export as namespace
export const reddit = {
  fetchSubreddit,
  fetchFromSubreddit,
  fetchAllSubreddits,
  fetchAllWSB, // Backwards compatible
  isAvailable,
  extractTickers,
  detectSentiment,
  calculateEngagement,
  getSubredditName,
  getSubredditWeight,
  SUBREDDIT_CONFIG,
};
