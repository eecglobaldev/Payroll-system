import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export default function SearchableMultiSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select options...',
  error
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter(opt => value.includes(opt.value));

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (optionValue: string) => {
    if (optionValue === '') {
      // Special handling for "All" option
      if (value.includes('')) {
        onChange([]);
      } else {
        onChange(['']);
      }
    } else {
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue && v !== '') // Remove the option and "All" if it exists
        : [...value.filter(v => v !== ''), optionValue]; // Add the option and remove "All" if it exists
      onChange(newValue);
    }
  };

  const getDisplayText = () => {
    if (value.length === 0) {
      return placeholder;
    }
    if (value.includes('')) {
      return 'All Branches';
    }
    if (value.length === 1) {
      const option = options.find(opt => opt.value === value[0]);
      return option?.label || placeholder;
    }
    return `${value.length} selected`;
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
          {label}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-5 py-4 bg-white/[0.03] border border-white/5 rounded-[20px] text-white flex items-center justify-between cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium
          ${isOpen ? 'ring-2 ring-indigo-500/20 bg-white/[0.05]' : ''}
          ${error ? 'border-rose-500/50' : ''}
        `}
      >
        <span className={value.length > 0 ? 'text-white' : 'text-slate-600'}>
          {getDisplayText()}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[100] glass-panel rounded-[20px] overflow-hidden border border-white/10 shadow-2xl animate-fade-in">
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-black/20 border border-white/5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/30 transition-all"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isChecked = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleOption(option.value);
                    }}
                    className={`
                      px-5 py-3 text-sm flex items-center gap-3 cursor-pointer transition-colors
                      ${isChecked ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-300 hover:bg-white/5'}
                    `}
                  >
                    <div className="flex items-center justify-center w-4 h-4 border-2 rounded border-white/20 flex-shrink-0">
                      {isChecked && (
                        <Check className="h-3 w-3 text-indigo-400" />
                      )}
                    </div>
                    <span className="font-medium flex-1">{option.label}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-4 text-xs text-slate-500 text-center font-medium uppercase tracking-widest">
                No matching entities
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[10px] text-rose-400 font-bold uppercase tracking-wide px-1">{error}</p>
      )}
    </div>
  );
}

