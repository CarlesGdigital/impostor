import { useEffect, useRef } from 'react';
import { useOfflineCards } from '@/hooks/useOfflineCards';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Component that syncs offline card data in the background.
 * Renders nothing visible - works silently on mount.
 */
export function OfflineDataSync() {
    const { syncCards, lastSync, hasOfflineData } = useOfflineCards();
    const { isOnline } = useOnlineStatus();
    const hasSynced = useRef(false);

    useEffect(() => {
        // Only sync once per session
        if (hasSynced.current) return;

        const shouldSync = () => {
            // Always sync if no data
            if (!hasOfflineData()) {
                console.info('[OfflineDataSync] No offline data, will sync');
                return true;
            }

            // Sync if data is stale (older than 24h)
            if (lastSync) {
                const age = Date.now() - lastSync.getTime();
                if (age > SYNC_INTERVAL_MS) {
                    console.info('[OfflineDataSync] Data is stale, will sync');
                    return true;
                }
            }

            return false;
        };

        if (isOnline && shouldSync()) {
            hasSynced.current = true;
            console.info('[OfflineDataSync] Starting background sync...');
            syncCards().then(ok => {
                if (ok) {
                    console.info('[OfflineDataSync] Background sync complete ✅');
                } else {
                    console.warn('[OfflineDataSync] Background sync failed');
                }
            });
        }
    }, [isOnline, lastSync, hasOfflineData, syncCards]);

    // Render nothing - this is a background worker component
    return null;
}
