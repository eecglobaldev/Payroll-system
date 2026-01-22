interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  size = 'md', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-12 w-12 border-2',
    lg: 'h-20 w-20 border-2',
  };

  const spinner = (
    <div className="relative flex items-center justify-center">
      <div
        className={`
          animate-spin rounded-full border-indigo-500/20 border-t-indigo-500
          ${sizeClasses[size]}
        `}
      />
      <div className="absolute w-4 h-4 bg-indigo-500 rounded-full blur-xl animate-pulse" />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0f172a] z-[100]">
        {spinner}
      </div>
    );
  }

  return <div className="flex justify-center py-20">{spinner}</div>;
}

