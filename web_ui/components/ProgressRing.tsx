"use client";

export function ProgressRing({
  value,
  size = 28,
}: {
  value: number; // 0..100
  size?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-zinc-200"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          className="stroke-zinc-900"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[9px] font-medium text-zinc-600">
        {Math.round(v)}%
      </div>
    </div>
  );
}

