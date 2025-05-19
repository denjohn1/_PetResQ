// hooks/useAutoRefresh.js
import { useEffect, useRef } from 'react';

const useAutoRefresh = (refreshCallback, interval = 30000) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    // Start the auto-refresh interval
    intervalRef.current = setInterval(() => {
      refreshCallback();
    }, interval);

    // Clean up the interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshCallback, interval]);

  // Function to manually trigger refresh
  const triggerRefresh = () => {
    refreshCallback();
  };

  return { triggerRefresh };
};

export default useAutoRefresh;