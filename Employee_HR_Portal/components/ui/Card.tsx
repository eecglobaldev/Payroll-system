
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  footer?: React.ReactNode;
  variant?: 'default' | 'glass' | 'plain';
}

const Card: React.FC<CardProps> = ({ children, title, className = '', footer, variant = 'glass' }) => {
  const baseStyles = "rounded-[2.5rem] transition-all duration-500";
  
  const variants = {
    glass: "bg-white/60 backdrop-blur-2xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)]",
    default: "bg-white border border-slate-100 shadow-sm",
    plain: "bg-transparent"
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} overflow-hidden animate-in ${className}`}>
      {title && (
        <div className="px-8 pt-8 pb-4">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600/60">{title}</h3>
        </div>
      )}
      <div className="px-8 py-6">
        {children}
      </div>
      {footer && (
        <div className="bg-white/30 backdrop-blur-md border-t border-white/20 px-8 py-4">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
