# Social Media Data Expansion Plan

## 🎯 Goal
Massively increase social media data sources for the Hype Model to improve prediction accuracy and confidence scores.

---

## 📱 Bluesky Expansion

### Current: 6 accounts (not actively fetched)
### Proposed: 50+ influential accounts + enhanced hashtag search

### **Finance Influencers to Add:**

#### **Market Analysts & Fund Managers**
- cathiewood.bsky.social (Already added)
- chamath.bsky.social (Already added)
- bill.ackman.bsky.social
- carlicahn.bsky.social
- ray.dalio.bsky.social
- warren.buffett.bsky.social (if exists)
- charlie.munger.bsky.social (if exists)

#### **Tech/Crypto Influencers**
- elonmusk.bsky.social (Already added)
- naval.bsky.social (Already added)
- balajis.bsky.social (Already added)
- vitalik.buterin.bsky.social
- pmarca.bsky.social (Marc Andreessen)
- jack.bsky.social (Jack Dorsey)

#### **Financial Media & Analysts**
- jimcramer.bsky.social (Already added)
- joshuabrown.bsky.social (The Reformed Broker)
- howardlindzon.bsky.social
- gary.black.bsky.social (Tesla analyst)
- michaeljburry.bsky.social (The Big Short)
- kjenner.bsky.social (Katie Jenner - markets)

#### **Retail Trader Influencers**
- roaringkitty.bsky.social (Keith Gill - if exists)
- unusual_whales.bsky.social
- fxhedgers.bsky.social
- zerohedge.bsky.social
- whale_alert.bsky.social

#### **Financial News Accounts**
- bloomberg.bsky.social
- cnbc.bsky.social
- wsj.bsky.social
- ft.bsky.social (Financial Times)
- marketwatch.bsky.social
- benzinga.bsky.social
- seekingalpha.bsky.social

### **Enhanced Hashtag/Keyword Search**

**Current:** "$SPY", "$AAPL", "$TSLA", "$NVDA", "stocks", "trading"

**Add:**
- **Major Indices:** $SPX, $QQQ, $DIA, $IWM, $VIX
- **Popular Stocks:** $MSFT, $GOOGL, $AMZN, $META, $AMD, $NFLX
- **Sectors:** #semiconductors, #EVs, #AI, #crypto, #biotech
- **Trading Terms:** #daytrading, #swingtrading, #stockmarket, #investing
- **Sentiment:** #bullish, #bearish, #FOMO, #BTD (buy the dip)
- **Events:** #earnings, #fed, #inflation, #jobs

---

## 🔴 Reddit Expansion

### Current: 4 subreddits
### Proposed: 15+ subreddits with increased limits

### **New Subreddits to Add:**

#### **High Activity Trading Subs**
```typescript
r/Daytrading (weight: 0.75) - Active day traders
r/pennystocks (weight: 0.6) - Small cap speculation
r/StockMarket (weight: 0.7) - General market discussion
r/stocks_penny (weight: 0.6) - Penny stock plays
r/ValueInvesting (weight: 0.65) - Value investors
r/Dividends (weight: 0.65) - Dividend investors
```

#### **Sector-Specific Subs**
```typescript
r/TechStocks (weight: 0.7) - Technology sector
r/Semiconductors (weight: 0.7) - Chip stocks
r/electricvehicles (weight: 0.7) - EV sector
r/Biotechplays (weight: 0.65) - Biotech sector
r/CryptoCurrency (weight: 0.65) - Crypto market sentiment
```

#### **Strategy & Analysis Subs**
```typescript
r/SwingTrading (weight: 0.7) - Swing traders
r/OptionsMillionaire (weight: 0.65) - Options strategies
r/thetagang (weight: 0.7) - Options selling strategies
r/Bogleheads (weight: 0.6) - Long-term investors
```

### **Post Sorting Enhancement**

**Current:** 'hot' + 'new' (25 each)

**Proposed:**
- 'hot': 30 posts
- 'new': 30 posts
- 'rising': 20 posts (NEW - catches emerging trending posts)
- 'top' (hour): 10 posts (NEW - highest rated in last hour)

**Total per subreddit:** ~90 posts (vs current 50)
**Total with 15 subreddits:** ~1,350 posts (vs current 200)

---

## 📰 RSS Feed Expansion

### Current Sources:
- MarketWatch Top Stories
- MarketWatch Market Pulse
- CNBC Top News
- Investing.com News

### **Add:**

#### **Financial News**
- Bloomberg Markets RSS
- Reuters Business RSS
- Yahoo Finance RSS
- Barron's RSS
- Seeking Alpha RSS

#### **Stock Tracking**
- Benzinga Stock News RSS
- The Motley Fool RSS
- Investor's Business Daily RSS

#### **Alternative Data**
- Reddit WSB RSS feed
- StockTwits trending RSS
- TradingView ideas RSS

---

## 🐦 Additional Platforms (Future)

### **StockTwits** (Code already exists!)
- Real-time stock sentiment platform
- Already integrated in `src/lib/stocktwits.ts`
- **Should activate:** Fetch trending symbols + sentiment data

### **Fintwit Aggregators**
- Track specific hashtags: #fintwit, #stocktwits
- Aggregate influential trader posts

---

## 📊 Proposed Data Volume

| Source | Current | Proposed | Increase |
|--------|---------|----------|----------|
| **Bluesky Posts** | ~50 | ~500 | 10x |
| **Bluesky Accounts** | 6 | 50+ | 8x |
| **Reddit Posts** | ~200 | ~1,350 | 6.7x |
| **Reddit Subs** | 4 | 15 | 3.7x |
| **RSS Feeds** | 4 | 12 | 3x |
| **Total Posts/Run** | ~250 | ~1,850+ | **7.4x** |

---

## ⚙️ Implementation Priority

### **Phase 1: Quick Wins** (Immediate)
1. ✅ Expand Reddit subreddits (add 11 more)
2. ✅ Add 'rising' sort to Reddit
3. ✅ Increase post limits (50 → 90 per subreddit)
4. ✅ Add more Bluesky hashtag searches

### **Phase 2: Influencer Tracking** (Next)
1. Add 50+ Bluesky finance accounts
2. Actually fetch from individual accounts (not just trending)
3. Weight posts by follower count

### **Phase 3: RSS Enhancement** (Later)
1. Add 8 more RSS feeds
2. Activate StockTwits integration

---

## 🎯 Expected Impact

### **Hype Model Improvements:**
- **More data points** → Higher confidence scores
- **Diverse sources** → Better accuracy
- **Real-time sentiment** → Faster signal detection
- **Sector coverage** → Better sector-specific predictions

### **Auto-Trader Activation:**
- Current: Rarely reaches 65% confidence
- Expected: Regular 70-80% confidence predictions
- Result: More auto-trades executed

---

## ⚠️ Considerations

### **Rate Limiting**
- Reddit: 60 requests/minute (should be fine with delays)
- Bluesky: No official limits on public API
- RSS: No limits (public feeds)

### **Processing Time**
- Current: ~30 seconds per run
- Expected: ~3-5 minutes per run
- Solution: Run in background, acceptable for cron job

### **Database Storage**
- Current: ~250 posts per run
- Expected: ~1,850 posts per run
- Storage: Minimal impact (text data)

### **API Costs**
- Gemini AI analysis: ~2,000 requests per run
- Current tier: Should handle (monitor usage)
- Can add batching if needed

---

## 🚀 Ready to Implement?

I can implement any or all of these expansions. Which would you like me to start with?

**Recommended Start:**
1. Expand Reddit (11 new subreddits + rising posts)
2. Add 30+ more Bluesky accounts
3. Enhance hashtag searches

This would give you **~5-7x more social data** immediately!
