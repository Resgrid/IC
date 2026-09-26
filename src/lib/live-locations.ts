import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

/**
 * Realtime unit/personnel positions pushed by the GeolocationHub, and how they move map pins.
 *
 * The hub broadcasts every location in the department to the whole department group. Unlike the
 * REST map endpoint it does not apply the per-viewer visibility matrix or the location TTLs, so a
 * push may only MOVE a pin the REST snapshot already contains — it must never create one.
 */

/** GetMapDataAndMarkers pin types a realtime position is allowed to move. */
const UNIT_PIN_TYPE = 1;
const PERSONNEL_PIN_TYPE = 3;

export type LiveLocationKind = 'unit' | 'personnel';

/** The latest realtime position for one unit or person, keyed by the map pin it moves. */
export interface LiveLocation {
  /** Lower-cased pin id: `u{unitId}` for units, `p{userId}` for personnel. */
  pinId: string;
  latitude: number;
  longitude: number;
  /** UTC time of the GPS fix (epoch ms), or null when the server did not send a usable one. */
  timestamp: number | null;
  /** Local clock (epoch ms) when this client received the push. */
  receivedAt: number;
}

export type LiveLocations = Record<string, LiveLocation>;

export interface ApplyLiveLocationsOptions {
  /**
   * Only apply positions received at or after this local time (epoch ms). A REST snapshot can be
   * older than a push that arrived while it was in flight, but newer than anything received before
   * the request started — those older positions must not be laid back over it.
   */
  receivedSince?: number;
}

export interface ApplyLiveLocationsResult {
  /** The same array when nothing moved; otherwise a copy with new objects for the moved pins only. */
  pins: MapMakerInfoData[];
  /** Live positions whose pin is not in `pins` (lower-cased pin ids). */
  unknownPinIds: string[];
}

/** Pin ids are compared case-insensitively: user ids are GUIDs whose casing varies by producer. */
export const toLivePinKey = (pinId: string): string => pinId.trim().toLowerCase();

type PayloadRecord = Record<string, unknown>;

/** The hub normally sends an object, but a producer that pre-serialises sends a JSON string. */
const toRecord = (payload: unknown): PayloadRecord | null => {
  let value = payload;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as PayloadRecord) : null;
};

/** SignalR's default JSON protocol sends camelCase; PascalCase is accepted from older producers. */
const readField = (record: PayloadRecord, camelCase: string, pascalCase: string): unknown => record[camelCase] ?? record[pascalCase];

const toEntityId = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const toCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// An ISO date-time with no zone designator; the server's fix time is UTC, but a DateTime with an
// unspecified kind serialises without the trailing Z and would otherwise be read as local time.
const ISO_WITHOUT_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const toTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Date.parse(ISO_WITHOUT_ZONE.test(trimmed) ? `${trimmed}Z` : trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Parses an `onUnitLocationUpdated` / `onPersonnelLocationUpdated` payload.
 *
 * The event, not the payload, decides whether it is a unit or a person. Returns null for anything
 * that cannot be placed on a map: a missing id, non-finite or out-of-range coordinates, or 0,0
 * (the shape of a missing value, not a real position).
 */
export const parseLiveLocation = (kind: LiveLocationKind, payload: unknown, receivedAt: number = Date.now()): LiveLocation | null => {
  const record = toRecord(payload);
  if (!record) {
    return null;
  }

  const entityId = toEntityId(kind === 'unit' ? readField(record, 'unitId', 'UnitId') : readField(record, 'userId', 'UserId'));
  if (!entityId) {
    return null;
  }

  const latitude = toCoordinate(readField(record, 'latitude', 'Latitude'));
  const longitude = toCoordinate(readField(record, 'longitude', 'Longitude'));
  if (latitude === null || longitude === null) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return {
    pinId: toLivePinKey(`${kind === 'unit' ? 'u' : 'p'}${entityId}`),
    latitude,
    longitude,
    timestamp: toTimestamp(readField(record, 'timestamp', 'Timestamp')),
    receivedAt,
  };
};

/**
 * Records a position, returning the same map when it is dropped.
 *
 * Trackers replay buffered fixes and queue consumers can reorder, so a fix OLDER than the one
 * already held for that pin is ignored. A missing timestamp (older servers) always applies.
 */
export const mergeLiveLocation = (current: LiveLocations, update: LiveLocation): LiveLocations => {
  const existing = current[update.pinId];
  if (existing && existing.timestamp !== null && update.timestamp !== null && update.timestamp < existing.timestamp) {
    return current;
  }
  return { ...current, [update.pinId]: update };
};

/**
 * Moves unit (Type 1) and personnel (Type 3) pins to their live positions.
 *
 * Never adds pins and never mutates: moved pins get new objects (MapPin is memoised on its pin) and
 * the array is only copied when something actually moved, so an update that changes nothing does not
 * re-render the map.
 */
export const applyLiveLocations = (pins: MapMakerInfoData[], liveLocations: LiveLocations, options: ApplyLiveLocationsOptions = {}): ApplyLiveLocationsResult => {
  const { receivedSince } = options;

  const pending = new Map<string, LiveLocation>();
  for (const location of Object.values(liveLocations)) {
    if (receivedSince !== undefined && location.receivedAt < receivedSince) {
      continue;
    }
    pending.set(toLivePinKey(location.pinId), location);
  }

  if (pending.size === 0) {
    return { pins, unknownPinIds: [] };
  }

  let next: MapMakerInfoData[] | null = null;
  const matched = new Set<string>();

  for (let index = 0; index < pins.length; index += 1) {
    const pin = pins[index];
    if (pin.Type !== UNIT_PIN_TYPE && pin.Type !== PERSONNEL_PIN_TYPE) {
      continue;
    }

    const key = toLivePinKey(pin.Id);
    const location = pending.get(key);
    if (!location) {
      continue;
    }

    matched.add(key);
    if (pin.Latitude === location.latitude && pin.Longitude === location.longitude) {
      continue;
    }

    if (next === null) {
      next = pins.slice();
    }
    next[index] = { ...pin, Latitude: location.latitude, Longitude: location.longitude };
  }

  const unknownPinIds = Array.from(pending.keys()).filter((key) => !matched.has(key));
  return { pins: next ?? pins, unknownPinIds };
};
