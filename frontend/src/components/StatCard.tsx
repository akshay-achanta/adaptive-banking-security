import { IconProps } from './Icons';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<IconProps>;
  badge?: {
    text: string;
    variant: 'success' | 'warning' | 'danger' | 'info';
  };
  variant?: 'blue' | 'purple' | 'amber' | 'rose' | 'emerald';
}

const variantStyles = {
  blue: {
    iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    border: 'hover:border-blue-500/40',
    glow: 'from-blue-600/10 to-transparent',
  },
  purple: {
    iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    border: 'hover:border-purple-500/40',
    glow: 'from-purple-600/10 to-transparent',
  },
  amber: {
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    border: 'hover:border-amber-500/40',
    glow: 'from-amber-600/10 to-transparent',
  },
  rose: {
    iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    border: 'hover:border-rose-500/40',
    glow: 'from-rose-600/10 to-transparent',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    border: 'hover:border-emerald-500/40',
    glow: 'from-emerald-600/10 to-transparent',
  },
};

const badgeStyles = {
  success: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
  warning: 'bg-amber-950/80 text-amber-400 border-amber-800/60',
  danger: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
  info: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  variant = 'blue',
}) => {
  const styles = variantStyles[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 ${styles.border} shadow-lg shadow-black/20`}
    >
      <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${styles.glow} blur-2xl pointer-events-none`} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`rounded-lg border p-2 ${styles.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-white font-mono">{value}</div>
        <div className="mt-2 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-400">{subtitle}</span>}
          {badge && (
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeStyles[badge.variant]}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
