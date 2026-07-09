// Mirrors Core/Resgrid.Model/IncidentCommand/IncidentCommandBundle.cs — the shift-start aggregate:
// a render-ready board (incl. computed accountability/PAR) per ACTIVE incident, in a single round-trip.

import { type IncidentAdHocPersonnel } from './incidentAdHocPersonnel';
import { type IncidentAdHocUnit } from './incidentAdHocUnit';
import { type IncidentCommandBoard } from './incidentCommandBoard';

export interface IncidentCommandBundle {
  /** Server clock (Unix epoch ms) captured at read start; seeds the next /Sync/Changes cursor. */
  ServerTimestampMs: number;
  /** One render-ready board (incl. accountability / PAR) per active incident command in the department. */
  Boards: IncidentCommandBoard[];
  /** Active ad-hoc units across the department's active incidents. */
  AdHocUnits: IncidentAdHocUnit[];
  /** Active ad-hoc personnel across the department's active incidents. */
  AdHocPersonnel: IncidentAdHocPersonnel[];
}
