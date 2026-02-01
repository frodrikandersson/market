import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

// Apple touch icon generation
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 80,
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
          border: '4px solid #00f0ff',
          borderRadius: '24px',
        }}
      >
        {/* Chart icon - larger version */}
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid background */}
          <line x1="0" y1="35" x2="140" y2="35" stroke="#00f0ff" strokeWidth="1.5" opacity="0.2" />
          <line x1="0" y1="70" x2="140" y2="70" stroke="#00f0ff" strokeWidth="1.5" opacity="0.2" />
          <line x1="0" y1="105" x2="140" y2="105" stroke="#00f0ff" strokeWidth="1.5" opacity="0.2" />
          <line x1="35" y1="0" x2="35" y2="140" stroke="#00f0ff" strokeWidth="1.5" opacity="0.2" />
          <line x1="70" y1="0" x2="70" y2="140" stroke="#00f0ff" strokeWidth="1.5" opacity="0.2" />
          <line x1="105" y1="0" x2="105" y2="140" stroke="#00f0ff" strokeWidth="1.5" opacity="0.2" />

          {/* Upward trending line */}
          <path
            d="M 15 120 L 40 100 L 70 75 L 100 45 L 125 15"
            stroke="#00ff88"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Data points */}
          <circle cx="15" cy="120" r="7" fill="#00ff88" />
          <circle cx="40" cy="100" r="7" fill="#00ff88" />
          <circle cx="70" cy="75" r="7" fill="#00ff88" />
          <circle cx="100" cy="45" r="7" fill="#00ff88" />
          <circle cx="125" cy="15" r="7" fill="#00ff88" />

          {/* Arrow at end */}
          <path
            d="M 125 15 L 115 20 M 125 15 L 120 25"
            stroke="#00ff88"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Glow effect */}
          <circle cx="125" cy="15" r="12" fill="#00ff88" opacity="0.2" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
