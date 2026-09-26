import { applyLiveLocations, type LiveLocation, mergeLiveLocation, parseLiveLocation } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

const RECEIVED_AT = 1_700_000_000_000;
const GUID = '5A0B6E1C-9F3D-4C2B-8E7A-1D2C3B4A5F60';

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

const live = (pinId: string, latitude: number, longitude: number, overrides: Partial<LiveLocation> = {}): LiveLocation => ({ pinId, latitude, longitude, timestamp: null, receivedAt: RECEIVED_AT, ...overrides });

describe('parseLiveLocation', () => {
  it('reads the camelCase unit payload the server sends', () => {
    const payload = { departmentId: 1, unitId: '12', latitude: 34.05, longitude: -118.24, recordId: 'r1', timestamp: '2026-09-25T14:03:11.123Z' };

    expect(parseLiveLocation('unit', payload, RECEIVED_AT)).toEqual({
      pinId: 'u12',
      latitude: 34.05,
      longitude: -118.24,
      timestamp: Date.parse('2026-09-25T14:03:11.123Z'),
      receivedAt: RECEIVED_AT,
    });
  });

  it('reads a camelCase personnel payload and lower-cases the GUID', () => {
    const payload = { departmentId: 1, userId: GUID, latitude: 34.05, longitude: -118.24, recordId: 'r1', timestamp: null };

    expect(parseLiveLocation('personnel', payload, RECEIVED_AT)).toEqual({ pinId: `p${GUID.toLowerCase()}`, latitude: 34.05, longitude: -118.24, timestamp: null, receivedAt: RECEIVED_AT });
  });

  it('accepts PascalCase field names', () => {
    const payload = { UnitId: 7, Latitude: 1.5, Longitude: 2.5, Timestamp: '2026-09-25T14:03:11Z' };

    expect(parseLiveLocation('unit', payload, RECEIVED_AT)).toEqual({ pinId: 'u7', latitude: 1.5, longitude: 2.5, timestamp: Date.parse('2026-09-25T14:03:11Z'), receivedAt: RECEIVED_AT });
  });

  it('accepts the payload as a JSON string', () => {
    const payload = JSON.stringify({ userId: GUID, latitude: -33.9, longitude: 151.2 });

    expect(parseLiveLocation('personnel', payload, RECEIVED_AT)?.pinId).toBe(`p${GUID.toLowerCase()}`);
  });

  it('decides unit vs person by the event, not by which id happens to be present', () => {
    const payload = { unitId: '12', userId: GUID, latitude: 1, longitude: 2 };

    expect(parseLiveLocation('unit', payload, RECEIVED_AT)?.pinId).toBe('u12');
    expect(parseLiveLocation('personnel', payload, RECEIVED_AT)?.pinId).toBe(`p${GUID.toLowerCase()}`);
  });

  it.each([
    ['a missing id', { latitude: 1, longitude: 2 }],
    ['a blank id', { unitId: '  ', latitude: 1, longitude: 2 }],
    ['a missing latitude', { unitId: '1', longitude: 2 }],
    ['a non-numeric latitude', { unitId: '1', latitude: 'north', longitude: 2 }],
    ['a non-finite longitude', { unitId: '1', latitude: 1, longitude: Infinity }],
    ['a latitude out of range', { unitId: '1', latitude: 91, longitude: 2 }],
    ['a longitude out of range', { unitId: '1', latitude: 1, longitude: -180.5 }],
    ['0,0', { unitId: '1', latitude: 0, longitude: 0 }],
  ])('rejects %s', (_label, payload) => {
    expect(parseLiveLocation('unit', payload, RECEIVED_AT)).toBeNull();
  });

  it.each([
    ['null', null],
    ['a number', 42],
    ['an array', [{ unitId: '1', latitude: 1, longitude: 2 }]],
    ['malformed JSON', '{"unitId":'],
  ])('rejects %s as a payload', (_label, payload) => {
    expect(parseLiveLocation('unit', payload, RECEIVED_AT)).toBeNull();
  });

  it('treats a missing, null or unparseable timestamp as unknown', () => {
    expect(parseLiveLocation('unit', { unitId: '1', latitude: 1, longitude: 2 }, RECEIVED_AT)?.timestamp).toBeNull();
    expect(parseLiveLocation('unit', { unitId: '1', latitude: 1, longitude: 2, timestamp: null }, RECEIVED_AT)?.timestamp).toBeNull();
    expect(parseLiveLocation('unit', { unitId: '1', latitude: 1, longitude: 2, timestamp: 'yesterday-ish' }, RECEIVED_AT)?.timestamp).toBeNull();
  });

  it('reads a zone-less ISO timestamp as UTC', () => {
    expect(parseLiveLocation('unit', { unitId: '1', latitude: 1, longitude: 2, timestamp: '2026-09-25T14:03:11.123' }, RECEIVED_AT)?.timestamp).toBe(Date.parse('2026-09-25T14:03:11.123Z'));
  });

  it('keeps an edge-of-range coordinate that is still valid', () => {
    expect(parseLiveLocation('unit', { unitId: '1', latitude: -90, longitude: 180 }, RECEIVED_AT)).not.toBeNull();
    // Only BOTH zero is the missing-value shape; the equator or the prime meridian alone is real.
    expect(parseLiveLocation('unit', { unitId: '1', latitude: 0, longitude: 32.5 }, RECEIVED_AT)).not.toBeNull();
  });
});

describe('mergeLiveLocation', () => {
  it('adds a new entity without touching the others', () => {
    const existing = { u1: live('u1', 1, 1) };
    const merged = mergeLiveLocation(existing, live('u2', 2, 2));

    expect(merged).toEqual({ u1: existing.u1, u2: live('u2', 2, 2) });
    expect(merged).not.toBe(existing);
    expect(existing).toEqual({ u1: live('u1', 1, 1) });
  });

  it('drops a fix older than the one already held and returns the same map', () => {
    const existing = { u1: live('u1', 1, 1, { timestamp: 2000 }) };

    expect(mergeLiveLocation(existing, live('u1', 5, 5, { timestamp: 1000 }))).toBe(existing);
  });

  it('applies a newer fix', () => {
    const existing = { u1: live('u1', 1, 1, { timestamp: 1000 }) };

    expect(mergeLiveLocation(existing, live('u1', 5, 5, { timestamp: 2000 })).u1.latitude).toBe(5);
  });

  it('always applies a fix with an unknown timestamp', () => {
    const existing = { u1: live('u1', 1, 1, { timestamp: 2000 }) };

    expect(mergeLiveLocation(existing, live('u1', 5, 5, { timestamp: null })).u1.latitude).toBe(5);
  });
});

describe('applyLiveLocations', () => {
  const unit = pin({ Id: 'u12', Type: 1, Latitude: 10, Longitude: 20 });
  const person = pin({ Id: `p${GUID}`, Type: 3, Latitude: 11, Longitude: 21 });
  const station = pin({ Id: 's3', Type: 2, Latitude: 12, Longitude: 22 });
  const pins = [unit, person, station];

  it('returns the same array when there is nothing to apply', () => {
    expect(applyLiveLocations(pins, {})).toEqual({ pins, unknownPinIds: [] });
    expect(applyLiveLocations(pins, {}).pins).toBe(pins);
  });

  it('returns the same array when the pin is already at that position', () => {
    const result = applyLiveLocations(pins, { u12: live('u12', 10, 20) });

    expect(result.pins).toBe(pins);
    expect(result.unknownPinIds).toEqual([]);
  });

  it('moves a pin immutably, replacing only that pin', () => {
    const result = applyLiveLocations(pins, { u12: live('u12', 10.5, 20.5) });

    expect(result.pins).not.toBe(pins);
    expect(result.pins[0]).toEqual({ ...unit, Latitude: 10.5, Longitude: 20.5 });
    expect(result.pins[0]).not.toBe(unit);
    expect(result.pins[1]).toBe(person);
    expect(result.pins[2]).toBe(station);
    // The input is untouched.
    expect(unit.Latitude).toBe(10);
    expect(pins[0]).toBe(unit);
  });

  it('matches personnel pins case-insensitively', () => {
    const result = applyLiveLocations(pins, { [`p${GUID.toLowerCase()}`]: live(`p${GUID.toLowerCase()}`, 11.5, 21.5) });

    expect(result.pins[1]).toEqual({ ...person, Latitude: 11.5, Longitude: 21.5 });
    expect(result.unknownPinIds).toEqual([]);
  });

  it('never adds a pin and reports it as unknown instead', () => {
    const result = applyLiveLocations(pins, { u99: live('u99', 1, 1) });

    expect(result.pins).toBe(pins);
    expect(result.pins).toHaveLength(3);
    expect(result.unknownPinIds).toEqual(['u99']);
  });

  it('only moves unit and personnel pins', () => {
    // A station whose id collides with a live key stays put.
    const odd = [pin({ Id: 'u12', Type: 2 })];
    const result = applyLiveLocations(odd, { u12: live('u12', 1, 1) });

    expect(result.pins).toBe(odd);
    expect(result.unknownPinIds).toEqual(['u12']);
  });

  it('ignores positions received before receivedSince (older than a fresh snapshot)', () => {
    const result = applyLiveLocations(pins, { u12: live('u12', 1, 1, { receivedAt: RECEIVED_AT - 1 }), [`p${GUID.toLowerCase()}`]: live(`p${GUID.toLowerCase()}`, 2, 2) }, { receivedSince: RECEIVED_AT });

    expect(result.pins[0]).toBe(unit);
    expect(result.pins[1]).toEqual({ ...person, Latitude: 2, Longitude: 2 });
  });
});
