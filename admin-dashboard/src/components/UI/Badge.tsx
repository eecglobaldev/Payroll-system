interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md';
}

const variantClasses = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  default: 'bg-white/5 text-slate-400 border-white/10',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
  md: 'px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
};

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'md' 
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-lg backdrop-blur-md border
        ${variantClasses[variant]}
        ${sizeClasses[size]}
      `}
    >
      {children}
    </span>
  );
}

