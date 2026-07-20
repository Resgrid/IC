// Mirrors Core/Resgrid.Model/PersonnelCallCheckInStatus.cs.

/** Colour-coded accountability/PAR status string returned by the backend. */
export type CheckInStatusColor = 'Green' | 'Warning' | 'Critical';

/** Check-in timer (accountability / PAR) status for a single dispatched person on an incident. */
export interface PersonnelCallCheckInStatus {
  UserId: string;
  /** Display name (first + last); may be null if the profile could not be resolved. */
  FullName: string | null;
  /** UTC timestamp of the most-recent check-in on this call, or null if never checked in. */
  LastCheckIn: string | null;
  /** True when the user must check in immediately (timer has expired). */
  NeedsCheckIn: boolean;
  /** Minutes until the next check-in is required; negative = minutes overdue. */
  MinutesRemaining: number;
  /** "Green" (within timer), "Warning" (within warning threshold), or "Critical" (expired). */
  Status: CheckInStatusColor;
  DurationMinutes: number;
  WarningThresholdMinutes: number;
}
