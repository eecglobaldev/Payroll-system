import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  error
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

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
        <span className={selectedOption ? 'text-white' : 'text-slate-600'}>
          {selectedOption ? selectedOption.label : placeholder}
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
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`
                    px-5 py-3 text-sm flex items-center justify-between cursor-pointer transition-colors
                    ${option.value === value ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-300 hover:bg-white/5'}
                  `}
                >
                  <span className="font-medium">{option.label}</span>
                  {option.value === value && <Check className="h-3.5 w-3.5" />}
                </div>
              ))
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

