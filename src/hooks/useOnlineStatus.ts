import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    console.info('[useOnlineStatus] Connection restored');
    setIsOnline(true);
    if (wasOffline) {
      // Connection was restored after being offline
      setWasOffline(false);
    }
  }, [wasOffline]);

  const handleOffline = useCallback(() => {
    console.info('[useOnlineStatus] Connection lost - switching to offline mode');
    setIsOnline(false);
    setWasOffline(true);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
