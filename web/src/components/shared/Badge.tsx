interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'text-tertiary bg-tertiary-fixed',
  warning: 'text-amber-600 bg-amber-50',
  error: 'text-error bg-error-container',
  info: 'text-primary bg-primary-fixed',
  default: 'text-on-surface-variant bg-surface-container-low',
};

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-label font-medium ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
