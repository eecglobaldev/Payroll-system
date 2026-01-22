import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="rounded-[32px] bg-rose-500/5 border border-rose-500/10 p-10 animate-fade-in text-center max-w-2xl mx-auto shadow-2xl">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10">
        <AlertCircle className="h-8 w-8 text-rose-400" />
      </div>
      <h3 className="text-xl font-black text-white tracking-tight mb-2">System Interruption</h3>
      <p className="text-slate-400 font-medium mb-8 leading-relaxed px-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white bg-rose-600 hover:bg-rose-500 rounded-2xl transition-all shadow-lg shadow-rose-600/20 active:scale-95"
        >
          Initialize Recovery
        </button>
      )}
    </div>
  );
}

