# Prediction Display Enhancement Plan

## Current Issues

### Issue 1: Missing Baseline Data
Predictions don't show:
- What price the prediction was based on
- The predicted percentage change (only shows UP/DOWN)

### Issue 2: Actual/Current Not Updating
- `actualDirection` and `actualChange` only update AFTER target date when evaluator runs
- Real-time tracker creates snapshots but doesn't update the main prediction record
- User sees "Pending" even though we're tracking real-time

## Solution

### Part 1: Store Baseline Price & Predicted Change
Update predictor to store:
1. **Baseline price** - Stock price when prediction was made
2. **Predicted change %** - How much we predict it will move

### Part 2: Show Real-Time Current Price
Update Recent Predictions table to show:
1. **Baseline price** in Predicted column
2. **Current price** from latest snapshot (if available)
3. **Current change %** vs baseline

### Part 3: Update Display Logic
- **Before target time:** Show current price from snapshots
- **After target time:** Show final actual result

## Implementation

Files to modify:
1. `src/services/predictor.ts` - Store baseline + predicted change
2. `src/components/RecentPredictionsTable.tsx` - Display improvements
3. Database query - Join with latest snapshot for current price
