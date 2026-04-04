import { useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../utils/cn';

export function Tooltip({ children, content, className }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className={cn('inline-flex items-center justify-center', className)}
      >
        {children || <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />}
      </button>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-slate-800 rounded-lg shadow-lg whitespace-nowrap max-w-xs">
          <div className="relative">
            {content}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-slate-800"></div>
          </div>
        </div>
      )}
    </div>
  );
}
