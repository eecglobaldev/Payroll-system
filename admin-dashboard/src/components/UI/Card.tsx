import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export default function Card({ children, className = '', title, action }: CardProps) {
  return (
    <div className={`glass-card rounded-[24px] overflow-hidden shadow-2xl ${className}`}>
      {(title || action) && (
        <div className="px-8 py-5 flex items-center justify-between border-b border-white/[0.05] bg-white/[0.01]">
          {title && (
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h2>
            </div>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-8">{children}</div>
    </div>
  );
}

