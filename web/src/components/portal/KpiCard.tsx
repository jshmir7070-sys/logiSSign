import Link from 'next/link';

interface KpiCardProps {
  title: string;
  value: string;
  accent: 'blue' | 'green' | 'amber' | 'violet';
  href?: string;
  warning?: boolean;
}

const accentStyles: Record<KpiCardProps['accent'], { dot: string; value: string }> = {
  blue: {
    dot: 'bg-primary',
    value: 'text-primary',
  },
  green: {
    dot: 'bg-tertiary',
    value: 'text-tertiary',
  },
  amber: {
    dot: 'bg-amber-500',
    value: 'text-amber-600',
  },
  violet: {
    dot: 'bg-violet-500',
    value: 'text-violet-600',
  },
};

export default function KpiCard({ title, value, accent, href, warning }: KpiCardProps) {
  const styles = accentStyles[accent];

  const content = (
    <div
      className={`relative bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col gap-3 transition-transform hover:scale-[1.02] ${
        href ? 'cursor-pointer' : ''
      } ${warning ? 'ring-2 ring-amber-400/40' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
        <span className="text-sm font-label text-on-surface-variant">{title}</span>
      </div>
      <span className={`text-3xl font-data font-bold tracking-tight ${styles.value}`}>
        {value}
      </span>
      {warning && (
        <span className="absolute top-4 right-4 text-amber-500">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2L1 18h18L10 2zm0 3.5l6.5 11.5h-13L10 5.5zM9 10v3h2v-3H9zm0 4v2h2v-2H9z" />
          </svg>
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
