
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-2xl font-bold transition-all duration-300 active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_30px_-5px_rgba(79,70,229,0.4)] hover:-translate-y-0.5',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-200 shadow-sm',
    danger: 'bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 shadow-sm',
    ghost: 'bg-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50',
    soft: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-none'
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs tracking-wider',
    md: 'px-6 py-3 text-sm tracking-wide',
    lg: 'px-8 py-4 text-base tracking-wide',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
