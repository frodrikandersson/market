'use client';

import { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface PriceDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | bigint;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  ticker: string;
}

type TimeRange = '7D' | '30D' | '90D';

export function PriceChart({ data, ticker }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [showVolume, setShowVolume] = useState(true);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        No price data available
      </div>
    );
  }

  // Filter data based on time range
  const now = new Date();
  const daysMap: Record<TimeRange, number> = { '7D': 7, '30D': 30, '90D': 90 };
  const cutoffDate = new Date(now.getTime() - daysMap[timeRange] * 24 * 60 * 60 * 1000);

  const filteredData = data
    .filter((d) => d.date >= cutoffDate)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Format data for chart (convert bigint to number for volume)
  const chartData = filteredData.map((d) => ({
    date: d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: typeof d.volume === 'bigint' ? Number(d.volume) : d.volume,
    // For coloring
    isUp: d.close >= d.open,
    // For line chart
    price: d.close,
  }));

  // Calculate stats
  const prices = filteredData.map((d) => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const startPrice = filteredData[0]?.close || 0;
  const endPrice = filteredData[filteredData.length - 1]?.close || 0;
  const priceChange = endPrice - startPrice;
  const priceChangePercent = startPrice ? ((priceChange / startPrice) * 100) : 0;
  const maxVolume = Math.max(...filteredData.map((d) => typeof d.volume === 'bigint' ? Number(d.volume) : d.volume));

  // Calculate Y-axis domain with padding
  const pricePadding = (maxPrice - minPrice) * 0.1;
  const yDomain = [minPrice - pricePadding, maxPrice + pricePadding];

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: typeof chartData[0] }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
          <p className="text-text-primary font-semibold mb-2">{data.date}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-text-muted">Open:</span>
            <span className="font-mono-numbers text-text-primary">${data.open.toFixed(2)}</span>
            <span className="text-text-muted">High:</span>
            <span className="font-mono-numbers text-positive">${data.high.toFixed(2)}</span>
            <span className="text-text-muted">Low:</span>
            <span className="font-mono-numbers text-negative">${data.low.toFixed(2)}</span>
            <span className="text-text-muted">Close:</span>
            <span className={`font-mono-numbers ${data.isUp ? 'text-positive' : 'text-negative'}`}>
              ${data.close.toFixed(2)}
            </span>
            <span className="text-text-muted">Volume:</span>
            <span className="font-mono-numbers text-text-secondary">
              {(data.volume / 1000000).toFixed(2)}M
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono-numbers text-text-primary">
              ${endPrice.toFixed(2)}
            </span>
            <span className={`text-lg font-mono-numbers ${priceChange >= 0 ? 'text-positive' : 'text-negative'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
          <p className="text-text-muted text-sm mt-1">
            {timeRange === '7D' ? 'Last 7 days' : timeRange === '30D' ? 'Last 30 days' : 'Last 90 days'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range buttons */}
          <div className="flex bg-background rounded-lg p-1">
            {(['7D', '30D', '90D'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  timeRange === range
                    ? 'bg-primary text-background font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-3 py-1 text-sm rounded transition-colors border ${
              showVolume
                ? 'border-primary/50 text-primary bg-primary/10'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            Vol
          </button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={showVolume ? 350 : 280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis
            dataKey="date"
            stroke="#6b6b7a"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#2a2a3a' }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            stroke="#6b6b7a"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#2a2a3a' }}
            domain={yDomain}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="left"
              stroke="#6b6b7a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#2a2a3a' }}
              domain={[0, maxVolume * 3]}
              tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
            />
          )}
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line at start price */}
          <ReferenceLine
            yAxisId="price"
            y={startPrice}
            stroke="#6b6b7a"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />

          {/* Volume bars */}
          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#6b6b7a"
              opacity={0.3}
              radius={[2, 2, 0, 0]}
            />
          )}

          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke={priceChange >= 0 ? '#00ff88' : '#ff3366'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: priceChange >= 0 ? '#00ff88' : '#ff3366' }}
          />

          {/* High/Low area could go here for candlestick effect */}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stats bar */}
      <div className="flex justify-between mt-4 pt-4 border-t border-border text-sm">
        <div className="flex gap-6">
          <div>
            <span className="text-text-muted">High: </span>
            <span className="font-mono-numbers text-positive">${maxPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-text-muted">Low: </span>
            <span className="font-mono-numbers text-negative">${minPrice.toFixed(2)}</span>
          </div>
        </div>
        <div>
          <span className="text-text-muted">Avg Vol: </span>
          <span className="font-mono-numbers text-text-secondary">
            {(filteredData.reduce((sum, d) => sum + (typeof d.volume === 'bigint' ? Number(d.volume) : d.volume), 0) / filteredData.length / 1000000).toFixed(2)}M
          </span>
        </div>
      </div>
    </div>
  );
}

// Mini sparkline version for dashboard cards
interface MiniPriceChartProps {
  data: { close: number }[];
  width?: number;
  height?: number;
}

export function MiniPriceChart({ data, width = 100, height = 30 }: MiniPriceChartProps) {
  if (data.length < 2) return null;

  const prices = data.map((d) => d.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  const isUp = endPrice >= startPrice;
  const color = isUp ? '#00ff88' : '#ff3366';

  // Create SVG path
  const points = prices.map((price, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
