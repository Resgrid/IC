import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/**
 * Live position deltas from the GeolocationHub.
 * The server pushes minimal payloads (id + lat/lon) for units and personnel;
 * merge them into the marker set in place — no refetch needed.
 *
 * Marker id convention from GetMapDataAndMarkers: `u{unitId}` units, `p{userId}` personnel.
 */
export const useMapGeolocationUpdates = (onMarkersUpdate: (updater: (prev: MapMakerInfoData[]) => MapMakerInfoData[]) => void) => {
  const lastProcessedTimestamp = useRef<number>(0);

  const lastGeolocationTimestamp = useSignalRStore((state) => state.lastGeolocationTimestamp);
  const lastGeolocationMessage = useSignalRStore((state) => state.lastGeolocationMessage);

  useEffect(() => {
    if (!lastGeolocationTimestamp || lastGeolocationTimestamp === lastProcessedTimestamp.current || !lastGeolocationMessage) {
      return;
    }
    lastProcessedTimestamp.current = lastGeolocationTimestamp;

    try {
      const payload = JSON.parse(String(lastGeolocationMessage)) as { UnitId?: string | number; UserId?: string; Latitude?: number | string; Longitude?: number | string };

      const latitude = Number(payload.Latitude);
      const longitude = Number(payload.Longitude);
      if (!isFinite(latitude) || !isFinite(longitude)) {
        return;
      }

      const markerId = payload.UnitId != null ? `u${payload.UnitId}` : payload.UserId ? `p${payload.UserId}` : null;
      if (!markerId) {
        return;
      }

      onMarkersUpdate((prev) => {
        const index = prev.findIndex((m) => m.Id === markerId);
        if (index === -1) {
          // Marker not on the board yet (filtered or new) — next snapshot refresh picks it up
          return prev;
        }
        const next = [...prev];
        next[index] = { ...next[index], Latitude: latitude, Longitude: longitude };
        return next;
      });
    } catch (error) {
      logger.warn({
        message: 'Failed to apply geolocation delta to map markers',
        context: { error },
      });
    }
  }, [lastGeolocationTimestamp, lastGeolocationMessage, onMarkersUpdate]);
};
