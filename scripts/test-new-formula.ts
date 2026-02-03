// Test the new confidence formula

const MIN_SIGNAL_THRESHOLD = 0.15;

function newFundamentalsConfidence(newsScore: number, volatility: number = 0): number | null {
  const signalStrength = Math.abs(newsScore);

  // Skip if below threshold
  if (signalStrength < MIN_SIGNAL_THRESHOLD) {
    return null; // Would be skipped
  }

  const volatilityPenalty = volatility ? Math.min(0.10, volatility * 2) : 0;
  const rawConfidence = 0.40 + (signalStrength * 0.70) - volatilityPenalty;
  return Math.max(0.40, Math.min(0.95, rawConfidence));
}

console.log('=== New Fundamentals Confidence Formula ===');
console.log('MIN_SIGNAL_THRESHOLD:', MIN_SIGNAL_THRESHOLD);
console.log('\nSignal Strength → Confidence (no volatility):');

const testSignals = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60, 0.70];
for (const signal of testSignals) {
  const conf = newFundamentalsConfidence(signal);
  if (conf === null) {
    console.log(`  ${signal.toFixed(2)} → SKIPPED (below threshold)`);
  } else {
    console.log(`  ${signal.toFixed(2)} → ${(conf * 100).toFixed(0)}%`);
  }
}

console.log('\n=== Comparison with Old Formula ===');
console.log('Signal | OLD Conf | NEW Conf');
console.log('-------|----------|----------');

function oldFundamentalsConfidence(newsScore: number, volatility: number = 0): number {
  const normalizedNews = Math.max(-1, Math.min(1, newsScore));
  const score = normalizedNews * 0.6;
  const baseConfidence = Math.abs(score);
  const volatilityPenalty = volatility ? Math.min(0.15, volatility * 3) : 0;
  const rawConfidence = baseConfidence * 0.95 + 0.25 - volatilityPenalty;
  return Math.max(0.30, Math.min(0.95, rawConfidence));
}

for (const signal of testSignals) {
  const oldConf = oldFundamentalsConfidence(signal);
  const newConf = newFundamentalsConfidence(signal);
  const newStr = newConf === null ? 'SKIP' : `${(newConf * 100).toFixed(0)}%`;
  console.log(`  ${signal.toFixed(2)}  |   ${(oldConf * 100).toFixed(0)}%    |   ${newStr}`);
}
