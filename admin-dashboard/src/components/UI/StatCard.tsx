import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const colorClasses = {
  blue: 'from-indigo-500/20 to-indigo-500/0 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10',
  green: 'from-emerald-500/20 to-emerald-500/0 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10',
  purple: 'from-violet-500/20 to-violet-500/0 text-violet-400 border-violet-500/20 shadow-violet-500/10',
  orange: 'from-amber-500/20 to-amber-500/0 text-amber-400 border-amber-500/20 shadow-amber-500/10',
};

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  color = 'blue' 
}: StatCardProps) {
  return (
    <div className="glass-card rounded-[24px] p-6 group hover:translate-y-[-4px] transition-all duration-500 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
            {trend && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${trend.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {trend.isPositive ? '+' : '-'}{trend.value}
              </span>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-2xl bg-gradient-to-br border shadow-2xl transition-all duration-500 group-hover:scale-110 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-6 h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
        <div className={`h-full w-1/2 bg-current opacity-30 rounded-full transition-all duration-1000 ${colorClasses[color].split(' ')[1]}`} />
      </div>
    </div>
  );
}

