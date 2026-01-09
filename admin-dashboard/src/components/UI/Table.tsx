import { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
}

export function Table({ children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full divide-y divide-white/20">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: TableProps) {
  return <thead className="bg-white/5">{children}</thead>;
}

export function TableBody({ children }: TableProps) {
  return <tbody className="divide-y divide-white/10">{children}</tbody>;
}

export function TableRow({ children, onClick }: TableProps & { onClick?: () => void }) {
  return (
    <tr 
      onClick={onClick}
      className={onClick ? 'hover:bg-white/5 cursor-pointer transition-colors' : 'hover:bg-white/5 transition-colors'}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ children }: TableProps) {
  return (
    <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-white/[0.05]">
      {children}
    </th>
  );
}

export function TableCell({ children }: TableProps) {
  return <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-300 font-medium">{children}</td>;
}

