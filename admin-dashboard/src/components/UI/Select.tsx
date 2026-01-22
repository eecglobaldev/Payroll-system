import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full px-5 py-4 bg-white/[0.03] border border-white/5 rounded-[20px] text-white appearance-none
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white/[0.05] transition-all font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-rose-500/50' : ''}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#0f172a] text-white">
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-2 text-[10px] text-rose-400 font-bold uppercase tracking-wide px-1">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;

