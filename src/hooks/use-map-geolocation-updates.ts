import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';

import { applyLiveLocations, type LiveLocations } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/** Coalescing window for the background refetch asked for by unknown pins or a hub rejoin. */
export const LIVE_LOCATION_REFRESH_DELAY_MS = 4000;

/**
 * How often one unknown pin may ask for a refetch. The hub sends every location in the department,
 * including entities this viewer is not allowed to see, and those never appear in the snapshot.
 */
export const UNKNOWN_PIN_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Lays live positions received since `fetchStartedAt` over a freshly fetched REST snapshot.
 *
 * The snapshot can be older than a push that arrived while it was in flight, so without this a
 * refetch rolls moved pins back. Positions received before the request started are older than the
 * snapshot and are left out.
 */
export const withLiveLocationsSince = (pins: MapMakerInfoData[], fetchStartedAt: number): MapMakerInfoData[] => applyLiveLocations(pins, useSignalRStore.getState().liveLocations, { receivedSince: fetchStartedAt }).pins;

/**
 * Moves unit and personnel pins in place from the GeolocationHub's realtime positions.
 *
 * Only positions that change after the map mounted are applied (anything already in the store is
 * older than the map's own snapshot). A position for a pin the snapshot does not contain never adds
 * a pin — the hub ignores the viewer's visibility rules — but asks `requestRefresh` for one coalesced
 * background refetch, at most once per pin per cooldown. A (re)join of the hub asks for one too,
 * since whatever was pushed while disconnected was missed.
 *
 * @param pins the map's full (unfiltered) pin set, used to spot positions for unknown pins
 * @param setPins the map's pin state setter; updates are functional and never mutate
 * @param requestRefresh the map's existing background refetch (from `useMapSignalRUpdates`)
 */
export const useMapGeolocationUpdates = (pins: MapMakerInfoData[], setPins: Dispatch<SetStateAction<MapMakerInfoData[]>>, requestRefresh?: () => void): void => {
  const liveLocations = useSignalRStore((state) => state.liveLocations);
  const lastGeolocationJoinAt = useSignalRStore((state) => state.lastGeolocationJoinAt);

  const pinsRef = useRef(pins);
  const requestRefreshRef = useRef(requestRefresh);
  const processedLocationsRef = useRef<LiveLocations>(liveLocations);
  const processedJoinAtRef = useRef(lastGeolocationJoinAt);
  const unknownRefreshRequestedAtRef = useRef<Record<string, number>>({});
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    requestRefreshRef.current = requestRefresh;
  }, [requestRefresh]);

  const scheduleRefresh = useCallback(() => {
    // One pending refetch covers every trigger that arrives inside the window.
    if (!requestRefreshRef.current || refreshTimerRef.current) {
      return;
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      requestRefreshRef.current?.();
    }, LIVE_LOCATION_REFRESH_DELAY_MS);
  }, []);

  useEffect(() => {
    const previous = processedLocationsRef.current;
    processedLocationsRef.current = liveLocations;
    if (previous === liveLocations) {
      return;
    }

    // Apply only what changed since the last pass, so an old position is never laid back over a
    // snapshot the map fetched after it.
    const changed: LiveLocations = {};
    let hasChanges = false;
    for (const [pinId, location] of Object.entries(liveLocations)) {
      if (previous[pinId] !== location) {
        changed[pinId] = location;
        hasChanges = true;
      }
    }
    if (!hasChanges) {
      return;
    }

    setPins((current) => applyLiveLocations(current, changed).pins);

    // Nothing is "unknown" while the first snapshot is still loading; that fetch lays these
    // positions over itself (withLiveLocationsSince).
    const currentPins = pinsRef.current;
    if (currentPins.length === 0 || !requestRefreshRef.current) {
      return;
    }

    const { unknownPinIds } = applyLiveLocations(currentPins, changed);
    if (unknownPinIds.length === 0) {
      return;
    }

    const now = Date.now();
    const requestedAt = unknownRefreshRequestedAtRef.current;
    const due = unknownPinIds.filter((pinId) => requestedAt[pinId] === undefined || now - requestedAt[pinId] >= UNKNOWN_PIN_REFRESH_COOLDOWN_MS);
    if (due.length === 0) {
      return;
    }
    due.forEach((pinId) => {
      requestedAt[pinId] = now;
    });
    scheduleRefresh();
  }, [liveLocations, setPins, scheduleRefresh]);

  useEffect(() => {
    if (processedJoinAtRef.current === lastGeolocationJoinAt) {
      return;
    }
    processedJoinAtRef.current = lastGeolocationJoinAt;
    if (lastGeolocationJoinAt > 0) {
      scheduleRefresh();
    }
  }, [lastGeolocationJoinAt, scheduleRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);
};
