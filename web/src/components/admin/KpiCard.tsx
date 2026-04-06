interface KpiCardProps {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down';
  accentColor?: string;
  icon: string;
}

export default function KpiCard({
  label,
  value,
  change,
  changeType,
  accentColor = '#2563eb',
  icon,
}: KpiCardProps) {
  const isPositive = changeType === 'up';

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col gap-4">
      {/* Top row: icon + change badge */}
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}14` }}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={{
              color: accentColor,
              fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 22",
            }}
          >
            {icon}
          </span>
        </div>
        {change ? (
          <span
            className={`
              inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-data text-[12px] font-semibold
              ${isPositive
                ? 'text-tertiary bg-tertiary/[0.08]'
                : 'text-error bg-error/[0.08]'
              }
            `}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 14" }}
            >
              {isPositive ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {change}
          </span>
        ) : (
          <span />
        )}
      </div>

      {/* Value */}
      <div>
        <p className="font-data text-on-surface text-[28px] font-bold tracking-tight leading-none">
          {value}
        </p>
        <p className="font-body text-on-surface-variant text-[13px] mt-1.5">
          {label}
        </p>
      </div>
    </div>
  );
}
