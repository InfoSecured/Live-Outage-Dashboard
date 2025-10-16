import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshControlsProps {
  onRefreshToggle: (enabled: boolean) => void;
  onIntervalChange: (minutes: number) => void;
  isRefreshing?: boolean;
  autoRefreshEnabled?: boolean;
  refreshInterval?: number;
}

export default function RefreshControls({
  onRefreshToggle,
  onIntervalChange,
  isRefreshing = false,
  autoRefreshEnabled = false,
  refreshInterval = 5,
}: RefreshControlsProps) {
  const [inputValue, setInputValue] = useState(String(refreshInterval));

  // Sync input value when refreshInterval prop changes
  useEffect(() => {
    setInputValue(String(refreshInterval));
  }, [refreshInterval]);

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 1440) {
      onIntervalChange(numValue);
    }
  };

  const handleToggle = () => {
    onRefreshToggle(!autoRefreshEnabled);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        <RefreshCw 
          className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''} text-gray-600 dark:text-gray-400`} 
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Auto-refresh
        </span>
      </div>

      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={autoRefreshEnabled}
          onChange={handleToggle}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
      </label>

      <div className="flex items-center gap-2">
        <label 
          htmlFor="refresh-interval" 
          className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap"
        >
          Interval:
        </label>
        <input
          id="refresh-interval"
          type="number"
          min="1"
          max="1440"
          value={inputValue}
          onChange={handleIntervalChange}
          disabled={!autoRefreshEnabled}
          className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="5"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          minutes
        </span>
      </div>

      {autoRefreshEnabled && (
        <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          Next refresh in {refreshInterval} min
        </div>
      )}
    </div>
  );
}
