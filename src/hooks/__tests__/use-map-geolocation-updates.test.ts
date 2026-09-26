import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';

import { type LiveLocation, type LiveLocations } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { LIVE_LOCATION_REFRESH_DELAY_MS, UNKNOWN_PIN_REFRESH_COOLDOWN_MS, useMapGeolocationUpdates, withLiveLocationsSince } from '../use-map-geolocation-updates';

// A real zustand store with just the slice the hook reads, so updates flow through subscriptions.
jest.mock('@/stores/signalr/signalr-store', () => {
  const { create } = jest.requireActual('zustand');
  return { useSignalRStore: create(() => ({ liveLocations: {}, lastGeolocationJoinAt: 0 })) };
});

const pin = (overrides: Partial<MapMakerInfoData>): MapMakerInfoData => ({
  Id: '',
  Latitude: 10,
  Longitude: 20,
  Title: '',
  zIndex: 0,
  ImagePath: '',
  InfoWindowContent: '',
  Color: '',
  Type: 1,
  PoiImage: '',
  ...overrides,
});

const unit = pin({ Id: 'u12', Type: 1, Latitude: 10, Longitude: 20 });
const person = pin({ Id: 'pABC-def', Type: 3, Latitude: 11, Longitude: 21 });
const station = pin({ Id: 's3', Type: 2, Latitude: 12, Longitude: 22 });

const live = (pinId: string, latitude: number, longitude: number): LiveLocation => ({ pinId, latitude, longitude, timestamp: null, receivedAt: Date.now() });

/** Pushes positions the way the store does: a new map, new objects only for the updated entities. */
const push = (...locations: LiveLocation[]) => {
  const next: LiveLocations = { ...useSignalRStore.getState().liveLocations };
  locations.forEach((location) => {
    next[location.pinId] = location;
  });
  useSignalRStore.setState({ liveLocations: next });
};

const renderMap = (initialPins: MapMakerInfoData[], requestRefresh?: () => void) =>
  renderHook(() => {
    const [pins, setPins] = useState(initialPins);
    useMapGeolocationUpdates(pins, setPins, requestRefresh);
    return { pins, setPins };
  });

describe('useMapGeolocationUpdates', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useSignalRStore.setState({ liveLocations: {}, lastGeolocationJoinAt: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves a known pin in place and leaves the others untouched', () => {
    const { result, unmount } = renderMap([unit, person, station]);

    act(() => push(live('u12', 10.5, 20.5)));

    expect(result.current.pins[0]).toEqual({ ...unit, Latitude: 10.5, Longitude: 20.5 });
    expect(result.current.pins[1]).toBe(person);
    expect(result.current.pins[2]).toBe(station);
    unmount();
  });

  it('matches personnel case-insensitively', () => {
    const { result, unmount } = renderMap([unit, person]);

    act(() => push(live('pabc-def', 11.5, 21.5)));

    expect(result.current.pins[1]).toEqual({ ...person, Latitude: 11.5, Longitude: 21.5 });
    unmount();
  });

  it('applies every position in a burst that lands in one render', () => {
    const second = pin({ Id: 'u13', Type: 1 });
    const { result, unmount } = renderMap([unit, second]);

    act(() => {
      push(live('u12', 1, 1));
      push(live('u13', 2, 2));
    });

    expect(result.current.pins.map((p) => [p.Latitude, p.Longitude])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    unmount();
  });

  it('does not lay positions received before the map mounted over its own snapshot', () => {
    push(live('u12', 1, 1));

    const { result, unmount } = renderMap([unit]);

    expect(result.current.pins[0]).toBe(unit);
    unmount();
  });

  it('does not roll a fresh snapshot back to an older live position', () => {
    const { result, unmount } = renderMap([unit]);

    act(() => push(live('u12', 1, 1)));
    // A refetch replaces the pins with a newer server position.
    const fresh = { ...unit, Latitude: 3, Longitude: 3 };
    act(() => result.current.setPins([fresh]));

    expect(result.current.pins[0]).toBe(fresh);

    // The next push still moves it.
    act(() => push(live('u12', 4, 4)));
    expect(result.current.pins[0]).toEqual({ ...unit, Latitude: 4, Longitude: 4 });
    unmount();
  });

  it('never adds a pin for a position it does not know', () => {
    const { result, unmount } = renderMap([unit]);

    act(() => push(live('u99', 1, 1)));

    expect(result.current.pins).toEqual([unit]);
    unmount();
  });

  it('requests one coalesced refetch for unknown pins', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderMap([unit], requestRefresh);

    act(() => push(live('u98', 1, 1)));
    act(() => push(live('u99', 1, 1)));

    act(() => jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS - 1));
    expect(requestRefresh).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('lets each unknown pin ask for a refetch at most once per cooldown', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderMap([unit], requestRefresh);

    act(() => push(live('u99', 1, 1)));
    act(() => jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS));
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    // Still not visible to this viewer: further positions stay quiet.
    act(() => push(live('u99', 2, 2)));
    act(() => jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS));
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_COOLDOWN_MS));
    act(() => push(live('u99', 3, 3)));
    act(() => jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS));
    expect(requestRefresh).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not ask for a refetch while the first snapshot is still loading', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderMap([], requestRefresh);

    act(() => push(live('u12', 1, 1)));
    act(() => jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS));

    expect(requestRefresh).not.toHaveBeenCalled();
    unmount();
  });

  it('requests one catch-up refetch when the hub (re)joins', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderMap([unit], requestRefresh);

    act(() => useSignalRStore.setState({ lastGeolocationJoinAt: Date.now() }));
    act(() => jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS));

    expect(requestRefresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('drops a pending refetch when the map unmounts', () => {
    const requestRefresh = jest.fn();
    const { unmount } = renderMap([unit], requestRefresh);

    act(() => useSignalRStore.setState({ lastGeolocationJoinAt: Date.now() }));
    unmount();
    jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);

    expect(requestRefresh).not.toHaveBeenCalled();
  });
});

describe('withLiveLocationsSince', () => {
  it('applies only positions received at or after the fetch started', () => {
    const fetchStartedAt = 5_000;
    useSignalRStore.setState({
      liveLocations: {
        u12: { pinId: 'u12', latitude: 1, longitude: 1, timestamp: null, receivedAt: fetchStartedAt },
        'pabc-def': { pinId: 'pabc-def', latitude: 2, longitude: 2, timestamp: null, receivedAt: fetchStartedAt - 1 },
      },
    });

    const pins = withLiveLocationsSince([unit, person], fetchStartedAt);

    expect(pins[0]).toEqual({ ...unit, Latitude: 1, Longitude: 1 });
    expect(pins[1]).toBe(person);
  });

  it('returns the snapshot itself when nothing applies', () => {
    useSignalRStore.setState({ liveLocations: {} });
    const snapshot = [unit, person];

    expect(withLiveLocationsSince(snapshot, 0)).toBe(snapshot);
  });
});
