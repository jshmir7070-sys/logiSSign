import React from 'react';

/* ═══════════════════════ Radio Option ═══════════════════════ */
export function RadioOption({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      onClick={onChange}
      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        checked
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-transparent hover:bg-surface-container-low'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <div
          className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
            checked ? 'border-primary' : 'border-outline-variant'
          }`}
        >
          {checked && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface font-korean">{label}</p>
        <p className="text-xs text-on-surface-variant/70 mt-0.5 font-korean">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ Section Toggle ═══════════════════════ */
export function SectionToggle({
  enabled,
  onToggle,
  label,
  icon,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-3 w-full p-3.5 rounded-xl transition-all border-2 ${
        enabled
          ? 'border-primary/30 bg-primary/[0.06]'
          : 'border-outline-variant/15 bg-surface-container-low/50 hover:border-outline-variant/30'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          enabled ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-sm font-bold font-korean ${
          enabled ? 'text-on-surface' : 'text-on-surface-variant'
        }`}
      >
        {label}
      </span>
      <div className="ml-auto">
        <div
          className={`relative w-11 h-6 rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-outline-variant/30'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
              enabled ? 'left-6' : 'left-1'
            }`}
          />
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════ Checkbox Option ═══════════════════════ */
export function CheckboxOption({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        checked
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-transparent hover:bg-surface-container-low'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <div
          className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${
            checked ? 'border-primary bg-primary' : 'border-outline-variant'
          }`}
        >
          {checked && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface font-korean">{label}</p>
        <p className="text-xs text-on-surface-variant/70 mt-0.5 font-korean">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ Icons ═══════════════════════ */
export const TruckIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
  </svg>
);
export const ReturnIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
export const PickupIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
  </svg>
);
export const GiftIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);
export const ShieldIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
export const AlertTriangleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
export const CarIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
  </svg>
);
export const FileTextIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
