// src/hooks/useAutoRefresh.ts
import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
  enabled: boolean;
  intervalMinutes: number;
  onRefresh: () => void | Promise<void>;
}

/**
 * Hook to automatically refresh data at specified intervals
 * @param enabled - Whether auto-refresh is enabled
 * @param intervalMinutes - Refresh interval in minutes
 * @param onRefresh - Callback function to execute on refresh
 */
export const useAutoRefresh = ({
  enabled,
  intervalMinutes,
  onRefresh,
}: UseAutoRefreshOptions) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(onRefresh);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up interval if enabled and interval is valid
    if (enabled && intervalMinutes > 0) {
      const intervalMs = intervalMinutes * 60 * 1000;

      intervalRef.current = setInterval(() => {
        callbackRef.current();
      }, intervalMs);

      // Log for debugging
      console.log(`Auto-refresh enabled: ${intervalMinutes} minute(s)`);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMinutes]);
};
