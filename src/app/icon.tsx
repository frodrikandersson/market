import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

// Icon generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00f0ff',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          position: 'relative',
          border: '2px solid #00f0ff',
          borderRadius: '4px',
        }}
      >
        {/* Chart icon - simple line going up */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid background */}
          <line x1="0" y1="7" x2="28" y2="7" stroke="#00f0ff" strokeWidth="0.5" opacity="0.3" />
          <line x1="0" y1="14" x2="28" y2="14" stroke="#00f0ff" strokeWidth="0.5" opacity="0.3" />
          <line x1="0" y1="21" x2="28" y2="21" stroke="#00f0ff" strokeWidth="0.5" opacity="0.3" />
          <line x1="7" y1="0" x2="7" y2="28" stroke="#00f0ff" strokeWidth="0.5" opacity="0.3" />
          <line x1="14" y1="0" x2="14" y2="28" stroke="#00f0ff" strokeWidth="0.5" opacity="0.3" />
          <line x1="21" y1="0" x2="21" y2="28" stroke="#00f0ff" strokeWidth="0.5" opacity="0.3" />

          {/* Upward trending line */}
          <path
            d="M 2 24 L 8 20 L 14 16 L 20 10 L 26 4"
            stroke="#00ff88"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Data points */}
          <circle cx="2" cy="24" r="2" fill="#00ff88" />
          <circle cx="8" cy="20" r="2" fill="#00ff88" />
          <circle cx="14" cy="16" r="2" fill="#00ff88" />
          <circle cx="20" cy="10" r="2" fill="#00ff88" />
          <circle cx="26" cy="4" r="2" fill="#00ff88" />

          {/* Arrow at end */}
          <path
            d="M 26 4 L 23 6 M 26 4 L 24 7"
            stroke="#00ff88"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
