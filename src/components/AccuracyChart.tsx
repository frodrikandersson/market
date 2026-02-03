'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';

interface AccuracyDataPoint {
  date: string;
  fundamentals: number;
  hype: number;
  fundamentalsCount?: number;
  hypeCount?: number;
}

interface AccuracyChartProps {
  data: AccuracyDataPoint[];
  title?: string;
  showArea?: boolean;
}

export function AccuracyChart({ data, title, showArea = false }: AccuracyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        No accuracy data available yet
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
          <p className="text-text-primary font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-text-secondary">
                {entry.dataKey === 'fundamentals' ? 'Fundamentals' : 'Hype'}:
              </span>
              <span className="font-mono-numbers" style={{ color: entry.color }}>
                {entry.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const ChartComponent = showArea ? ComposedChart : LineChart;

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-base md:text-lg font-semibold text-text-primary mb-3 md:mb-4">{title}</h3>
      )}
      <div className="h-[200px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis
            dataKey="date"
            stroke="#6b6b7a"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: '#2a2a3a' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#6b6b7a"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: '#2a2a3a' }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span className="text-text-secondary text-sm">
                {value === 'fundamentals' ? 'Fundamentals' : 'Hype Model'}
              </span>
            )}
          />

          {showArea && (
            <>
              <Area
                type="monotone"
                dataKey="fundamentals"
                fill="#00f0ff"
                fillOpacity={0.1}
                stroke="transparent"
              />
              <Area
                type="monotone"
                dataKey="hype"
                fill="#7b61ff"
                fillOpacity={0.1}
                stroke="transparent"
              />
            </>
          )}

          <Line
            type="monotone"
            dataKey="fundamentals"
            stroke="#00f0ff"
            strokeWidth={2}
            dot={{ fill: '#00f0ff', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#00f0ff' }}
          />
          <Line
            type="monotone"
            dataKey="hype"
            stroke="#7b61ff"
            strokeWidth={2}
            dot={{ fill: '#7b61ff', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#7b61ff' }}
          />
        </ChartComponent>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

interface CalibrationDataPoint {
  bucket: string;
  expectedAccuracy: number;
  fundamentalsAccuracy: number;
  hypeAccuracy: number;
  fundamentalsCount: number;
  hypeCount: number;
}

interface CalibrationChartProps {
  data: CalibrationDataPoint[];
}

export function CalibrationChart({ data }: CalibrationChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        No calibration data available yet
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string; color: string; name: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const dataPoint = data.find((d) => d.bucket === label);
      return (
        <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
          <p className="text-text-primary font-semibold mb-2">{label} Confidence</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-text-secondary">{entry.name}:</span>
              <span className="font-mono-numbers" style={{ color: entry.color }}>
                {entry.value.toFixed(1)}%
              </span>
              {entry.dataKey === 'fundamentalsAccuracy' && dataPoint && (
                <span className="text-text-muted text-xs">
                  ({dataPoint.fundamentalsCount} predictions)
                </span>
              )}
              {entry.dataKey === 'hypeAccuracy' && dataPoint && (
                <span className="text-text-muted text-xs">
                  ({dataPoint.hypeCount} predictions)
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Confidence Calibration</h3>
        <p className="text-xs text-text-muted">
          Dotted line = perfect calibration
        </p>
      </div>
      <div className="h-[200px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis
            dataKey="bucket"
            stroke="#6b6b7a"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#2a2a3a' }}
          />
          <YAxis
            stroke="#6b6b7a"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#2a2a3a' }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span className="text-text-secondary text-sm">
                {value === 'expectedAccuracy' ? 'Perfect Calibration' :
                 value === 'fundamentalsAccuracy' ? 'Fundamentals' : 'Hype Model'}
              </span>
            )}
          />

          {/* Perfect calibration line (diagonal) */}
          <Line
            type="monotone"
            dataKey="expectedAccuracy"
            stroke="#6b6b7a"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Perfect Calibration"
          />

          <Line
            type="monotone"
            dataKey="fundamentalsAccuracy"
            stroke="#00f0ff"
            strokeWidth={2}
            dot={{ fill: '#00f0ff', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#00f0ff' }}
            name="Fundamentals"
          />
          <Line
            type="monotone"
            dataKey="hypeAccuracy"
            stroke="#7b61ff"
            strokeWidth={2}
            dot={{ fill: '#7b61ff', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#7b61ff' }}
            name="Hype Model"
          />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-text-muted mt-2 text-center">
        If a model predicts with 70% confidence, it should be correct ~70% of the time
      </p>
    </div>
  );
}

interface ModelComparisonChartProps {
  fundamentalsWins: number;
  hypeWins: number;
  ties: number;
}

export function ModelComparisonChart({ fundamentalsWins, hypeWins, ties }: ModelComparisonChartProps) {
  const total = fundamentalsWins + hypeWins + ties;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-muted">
        No comparison data available
      </div>
    );
  }

  const fundamentalsPercent = (fundamentalsWins / total) * 100;
  const hypePercent = (hypeWins / total) * 100;
  const tiesPercent = (ties / total) * 100;

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Model Showdown</h3>
      <p className="text-xs text-text-muted mb-4">
        When both models predict the same stock, which one is right more often?
      </p>

      {/* Visual bar */}
      <div className="h-8 rounded-full overflow-hidden flex mb-4">
        <div
          className="bg-primary flex items-center justify-center transition-all duration-500"
          style={{ width: `${fundamentalsPercent}%` }}
        >
          {fundamentalsPercent > 15 && (
            <span className="text-xs font-bold text-background">
              {fundamentalsPercent.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="bg-neutral flex items-center justify-center transition-all duration-500"
          style={{ width: `${tiesPercent}%` }}
        >
          {tiesPercent > 15 && (
            <span className="text-xs font-bold text-background">
              {tiesPercent.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="bg-secondary flex items-center justify-center transition-all duration-500"
          style={{ width: `${hypePercent}%` }}
        >
          {hypePercent > 15 && (
            <span className="text-xs font-bold text-background">
              {hypePercent.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded" />
          <span className="text-text-secondary">Fundamentals</span>
          <span className="font-mono-numbers text-primary">{fundamentalsWins}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-neutral rounded" />
          <span className="text-text-secondary">Ties</span>
          <span className="font-mono-numbers text-neutral">{ties}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-secondary rounded" />
          <span className="text-text-secondary">Hype</span>
          <span className="font-mono-numbers text-secondary">{hypeWins}</span>
        </div>
      </div>
    </div>
  );
}
