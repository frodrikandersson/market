# Prediction System Improvements

## Summary of Changes

This document outlines the major improvements made to the stock prediction system to address confidence issues, real-time tracking, and social media integration.

---

## 1. ✅ Real-Time Prediction Tracking

### Problem
Predictions were only evaluated ONCE after the target date passed. There was no way to see how accurate predictions were in real-time.

### Solution
Added **PredictionSnapshot** system that tracks predictions every 15 minutes during market hours.

### New Features

#### Database Schema
- **PredictionSnapshot** table stores snapshots of prediction accuracy over time
- **Prediction** table now includes:
  - `timeframe`: "15min", "1hour", "4hour", "1day", "1week"
  - `targetTime`: Exact target datetime for intraday predictions
  - `predictedChange`: Predicted % change (not just direction)
  - `currentDeviation`: How far off the prediction currently is
  - `lastCheckedAt`: Last time we checked the price

#### New Service: Real-Time Tracker
**File:** [src/services/real-time-tracker.ts](src/services/real-time-tracker.ts)

Functions:
- `trackActivePredictions()`: Checks all active predictions against current prices
- `getPredictionProgress(predictionId)`: Gets detailed progress for a specific prediction

#### New Cron Endpoint
**URL:** `GET /api/cron/track-predictions?secret=YOUR_CRON_SECRET`

**Schedule:** Every 15 minutes during market hours (9:30 AM - 4:00 PM ET)

**Cron Expression:** `*/15 9-16 * * 1-5`

### How to Use

1. **Setup Cron Job** (using cron-job.org or similar):
   ```
   Schedule: */15 9-16 * * 1-5
   URL: https://your-domain.com/api/cron/track-predictions?secret=YOUR_CRON_SECRET
   Method: GET
   ```

2. **Check Prediction Progress**:
   ```typescript
   import { getPredictionProgress } from '@/services/real-time-tracker';

   const progress = await getPredictionProgress(predictionId);
   console.log(`Current deviation: ${progress.latest.deviation}%`);
   console.log(`Accuracy rate: ${progress.accuracy.accuracyRate}%`);
   ```

---

## 2. ✅ Improved Confidence Formulas

### Problem
AI predictions never reached 65% confidence threshold needed for auto-trading because formulas were too conservative.

### Root Causes Identified
1. **Volatility penalty** was too harsh (up to -30%)
2. **Base confidence** was multiplied by conservative factors (0.7x, 0.8x)
3. **News/Social impact scores** were often 0 or near 0

### Changes Made

#### Fundamentals Model
**File:** [src/services/predictor.ts:93-128](src/services/predictor.ts#L93-L128)

**OLD Formula:**
```typescript
volatilityPenalty = min(0.3, volatility * 5)
confidence = (baseConfidence * 0.8 + 0.2) - volatilityPenalty
// Max achievable: ~0.70 after penalty
```

**NEW Formula:**
```typescript
volatilityPenalty = min(0.15, volatility * 3)  // Reduced from 0.3 to 0.15
confidence = (baseConfidence * 0.95 + 0.25) - volatilityPenalty
// Max achievable: ~0.95 with strong signals
```

#### Hype Model
**File:** [src/services/predictor.ts:134-169](src/services/predictor.ts#L134-L169)

**OLD Formula:**
```typescript
baseConfidence = abs(score) * 0.7 + 0.25
confidence = min(0.85, baseConfidence)  // Capped at 0.85
```

**NEW Formula:**
```typescript
baseConfidence = abs(score) * 0.85 + 0.3
confidence = min(0.95, baseConfidence)  // Can reach 0.95
```

### Expected Results
- With **strong news sentiment** (0.8+): Confidence can reach **70-80%**
- With **strong social sentiment** (0.8+): Confidence can reach **75-85%**
- With **combined signals**: Confidence can reach **85-95%**

### Important Notes
⚠️ These formulas are more generous, but predictions still need **actual data** to generate high confidence:
- News must be fetched and analyzed
- Social media posts must be fetched and analyzed
- Sentiment analysis must produce non-zero scores

---

## 3. ✅ Bluesky Integration (Replaces Twitter)

### Problem
Twitter API is unreliable and expensive. Need alternative social media source for hype model.

### Solution
Integrated **Bluesky (AT Protocol)** as primary social media source.

### New Features

#### Bluesky API Client
**File:** [src/lib/bluesky.ts](src/lib/bluesky.ts)

Functions:
- `getUserPosts(handle, options)`: Fetch posts from a user
- `getInfluentialPosts()`: Fetch from finance influencers
- `searchPosts(query)`: Search for posts by keyword/ticker
- `getTrendingFinancePosts()`: Get trending finance content

**Influential Accounts Tracked:**
- elonmusk.bsky.social
- cathiewood.bsky.social
- jimcramer.bsky.social
- chamath.bsky.social
- naval.bsky.social
- balajis.bsky.social

#### Updated Social Processor
**File:** [src/services/social-processor.ts](src/services/social-processor.ts)

New function: `fetchBlueskyPosts()`

**Pipeline Now:**
1. Step 1: Fetch from Financial News RSS
2. Step 2: Fetch from Reddit
3. **Step 3: Fetch from Bluesky** ⬅ NEW!
4. Step 4: AI Analysis (Gemini)

### How to Use

**No API key required!** Bluesky's public API is free and open.

The system will automatically:
1. Fetch trending finance posts from Bluesky
2. Extract $TICKER cashtags
3. Store posts in database
4. Analyze sentiment with AI
5. Create company mentions

---

## 4. 📋 To Address: Low Social Data Issue

### Current Status
Even with improved formulas, if there's **no social/news data**, confidence will still be low.

### Steps to Fix

#### A. Verify Data is Being Fetched

Run the cron jobs manually to populate data:

```powershell
# Fetch all data sources
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/fetch-social?secret=YOUR_CRON_SECRET" -Method GET

# Fetch news
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/fetch-news?secret=YOUR_CRON_SECRET" -Method GET

# Run predictions
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/run-predictions?secret=YOUR_CRON_SECRET" -Method GET
```

#### B. Check Database for Social Data

```sql
-- Check if social posts exist
SELECT platform, COUNT(*) FROM "InfluentialAccount"
JOIN "SocialPost" ON "SocialPost"."accountId" = "InfluentialAccount".id
GROUP BY platform;

-- Check social mentions for a company
SELECT sm.sentiment, sm.confidence, sp.content
FROM "SocialMention" sm
JOIN "SocialPost" sp ON sm."postId" = sp.id
JOIN "Company" c ON sm."companyId" = c.id
WHERE c.ticker = 'AAPL'
ORDER BY sp."publishedAt" DESC
LIMIT 10;
```

#### C. Check News Impact Scores

```sql
-- Check news impacts
SELECT c.ticker, ni.sentiment, ni."impactScore", ni.confidence
FROM "NewsImpact" ni
JOIN "Company" c ON ni."companyId" = c.id
WHERE ni."createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY ni."createdAt" DESC;
```

#### D. Debug Prediction Inputs

Add logging to see what inputs the predictor is receiving:

```typescript
// In src/services/predictor.ts, after line 269
console.log(`[Predictor] ${ticker} inputs:`, {
  newsImpact: newsImpact.score,
  socialImpact: socialImpact.score,
  volatility,
  momentum,
});
```

---

## 5. 📊 How to Monitor System Health

### Check Cron Job History
```sql
SELECT * FROM "CronJob"
ORDER BY "startedAt" DESC
LIMIT 10;
```

### Check Latest Predictions
```sql
SELECT
  c.ticker,
  p.modelType,
  p.predictedDirection,
  p.confidence,
  p."newsImpactScore",
  p."socialImpactScore",
  p."currentDeviation",
  p."lastCheckedAt"
FROM "Prediction" p
JOIN "Company" c ON p."companyId" = c.id
WHERE p."evaluatedAt" IS NULL
ORDER BY p."predictionDate" DESC;
```

### Check Prediction Snapshots
```sql
SELECT
  ps."checkedAt",
  ps."currentPrice",
  ps."priceChange",
  ps.deviation,
  ps."isCorrect",
  c.ticker
FROM "PredictionSnapshot" ps
JOIN "Prediction" p ON ps."predictionId" = p.id
JOIN "Company" c ON p."companyId" = c.id
WHERE c.ticker = 'AAPL'
ORDER BY ps."checkedAt" DESC
LIMIT 20;
```

---

## 6. 🚀 Next Steps

### Immediate Actions

1. **Setup Real-Time Tracking Cron** (every 15 mins)
   - Schedule: `*/15 9-16 * * 1-5`
   - URL: `/api/cron/track-predictions?secret=YOUR_SECRET`

2. **Run Full Pipeline Once** to populate data
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/cron/full-pipeline?secret=YOUR_SECRET" -Method GET
   ```

3. **Check if predictions now have higher confidence**
   - Run: `/api/cron/run-predictions?secret=YOUR_SECRET`
   - Check database for predictions with confidence > 0.65

4. **Monitor auto-trader**
   - Check if trades are being executed
   - Review paper portfolios: `/api/cron/run-predictions` includes auto-trade execution

### Optional Enhancements

1. **Add UI for Real-Time Tracking**
   - Show prediction progress chart
   - Display current deviation vs predicted change
   - Show accuracy timeline

2. **Adjust Timeframes**
   - Currently defaults to 1-day predictions
   - Could add 1-hour, 4-hour predictions for day trading

3. **Fine-Tune Weights**
   - If Bluesky is too noisy, reduce weight
   - If Reddit sentiment is more accurate, increase weight

4. **Add More Bluesky Accounts**
   - Edit `FINANCE_ACCOUNTS` in [src/lib/bluesky.ts](src/lib/bluesky.ts)
   - Add accounts that frequently discuss stocks

---

## 7. 🐛 Troubleshooting

### Issue: Confidence Still Low

**Possible Causes:**
1. No news/social data in last 24 hours
2. Sentiment analysis returning neutral
3. News/social impact scores are weak

**Debug Steps:**
```typescript
// Add to predictor.ts after line 269
const newsImpact = await getNewsImpact(companyId, 24);
const socialImpact = await getSocialImpact(companyId, 24);

console.log('[DEBUG] Input scores:', {
  ticker,
  newsScore: newsImpact.score,
  socialScore: socialImpact.score,
  newsSentiments: newsImpact.sentiments,
  socialSentiments: socialImpact.sentiments,
});
```

### Issue: No Predictions Generated

**Check:**
1. Are companies marked as `isActive: true`?
2. Is there recent news for the company?
3. Did the fetch-news cron run successfully?

### Issue: Auto-Trader Not Buying

**Requirements for trades:**
- Confidence >= 0.65
- Portfolio has available cash
- Stock isn't already in portfolio (for buy orders)

**Check portfolio status:**
```sql
SELECT * FROM "PaperPortfolio" WHERE "isActive" = true;
SELECT * FROM "PaperPosition";
SELECT * FROM "PaperTrade" ORDER BY "executedAt" DESC LIMIT 10;
```

---

## 8. 📝 Files Changed

### New Files
- `src/services/real-time-tracker.ts` - Real-time tracking service
- `src/app/api/cron/track-predictions/route.ts` - Tracking cron endpoint
- `src/lib/bluesky.ts` - Bluesky API integration
- `PREDICTION_IMPROVEMENTS.md` - This documentation

### Modified Files
- `prisma/schema.prisma` - Added prediction tracking fields
- `src/services/predictor.ts` - Improved confidence formulas
- `src/services/social-processor.ts` - Added Bluesky integration

### Schema Changes
- Added `PredictionSnapshot` model
- Added fields to `Prediction`: timeframe, targetTime, predictedChange, currentDeviation, lastCheckedAt
- Added snapshots relation to Prediction

---

## 9. 🎯 Expected Outcomes

After implementing these changes:

1. **Higher Confidence Scores**
   - Predictions with strong signals should reach 70-95% confidence
   - More auto-trades should execute

2. **Real-Time Accuracy**
   - See how predictions perform over time
   - Identify which timeframes are most accurate

3. **Better Social Data**
   - Bluesky provides free, open access
   - More consistent than Twitter/Nitter

4. **Data-Driven Improvements**
   - Use snapshots to tune formulas
   - Identify which factors are most predictive

---

## Contact & Support

If you have questions or need help implementing these changes, check:
- This documentation file
- Code comments in modified files
- Database schema in `prisma/schema.prisma`
