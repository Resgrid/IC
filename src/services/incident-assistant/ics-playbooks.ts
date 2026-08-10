/**
 * NIMS/ICS knowledge the on-device incident assistant reasons with.
 *
 * This is the on-device mirror of Core's `Resgrid.Chatbot/Services/IcsPlaybooks.cs` — the two must
 * stay in sync so a commander gets the same guidance whether the answer came from the server or from
 * the phone with no signal. It is shipped as code rather than fetched so it is available offline with
 * no download, no model, and no setup.
 *
 * The doctrine text below is intentionally NOT run through `t()`, matching the backend's `EnOnly`
 * treatment of the same content: these are dense ICS terms whose translation needs a subject-matter
 * expert per locale rather than a literal one, and a mistranslated fireground benchmark is worse than
 * an English one. Everything the UI itself says — headings, labels, generated answer sentences — IS
 * translated (see the `incident_assistant.*` keys).
 *
 * Nothing here is department policy. It is the common doctrine an IC is trained against, and answers
 * built from it are always framed as prompts to the commander, never as orders.
 */

import { IncidentRoleType } from '@/models/v4/incidentCommand/incidentCommandModels';

/** Incident families the assistant carries guidance for. Mirrors Core `IncidentPlaybookType`. */
export type IncidentPlaybookType =
  | 'General'
  | 'StructureFire'
  | 'Wildland'
  | 'VehicleAccident'
  | 'Ems'
  | 'MassCasualty'
  | 'HazMat'
  | 'NaturalDisaster'
  | 'SearchAndRescue'
  | 'TechnicalRescue'
  | 'WaterRescue'
  | 'ActiveThreat';

/**
 * A one-tap prompt on the command board. `labelKey` is what the commander reads (translated);
 * `question` is the canonical English text handed to the matcher — the intent patterns are
 * English-only, exactly like the backend's classifier.
 */
export interface IncidentSuggestion {
  labelKey: string;
  question: string;
}

export interface IncidentPlaybook {
  type: IncidentPlaybookType;
  /** English display name; also what the answers call this incident family. */
  displayName: string;
  /** Lower-case terms matched against the call's type/name/nature to infer this playbook. */
  keywords: string[];
  /** Tactical benchmarks, matched loosely against the board's objectives to report progress. */
  benchmarks: string[];
  /** Doctrine checklist, ordered roughly by when it matters. */
  checklist: string[];
  /** ICS positions this incident type normally needs filled. */
  keyRoles: IncidentRoleType[];
  suggestions: IncidentSuggestion[];
}

const SUGGESTION = {
  par: { labelKey: 'incident_assistant.suggestions.par', question: 'PAR' },
  status: { labelKey: 'incident_assistant.suggestions.status', question: 'Incident status' },
  openObjectives: { labelKey: 'incident_assistant.suggestions.open_objectives', question: 'What objectives are still open?' },
  span: { labelKey: 'incident_assistant.suggestions.span', question: 'Span of control' },
  missing: { labelKey: 'incident_assistant.suggestions.missing', question: 'What am I missing?' },
  rit: { labelKey: 'incident_assistant.suggestions.rit', question: 'Do I have a RIT?' },
  wind: { labelKey: 'incident_assistant.suggestions.wind', question: 'What is the wind doing?' },
  openNeeds: { labelKey: 'incident_assistant.suggestions.open_needs', question: 'What needs are still open?' },
  unfilledRoles: { labelKey: 'incident_assistant.suggestions.unfilled_roles', question: 'Which ICS positions are unfilled?' },
  onScene: { labelKey: 'incident_assistant.suggestions.on_scene', question: 'What resources do I have on scene?' },
  recent: { labelKey: 'incident_assistant.suggestions.recent', question: 'What happened in the last 30 minutes?' },
  briefing: { labelKey: 'incident_assistant.suggestions.briefing', question: 'Give me a transfer of command briefing' },
  safety: { labelKey: 'incident_assistant.suggestions.safety', question: 'Who is the safety officer?' },
  unassigned: { labelKey: 'incident_assistant.suggestions.unassigned', question: 'Who is unassigned?' },
  timers: { labelKey: 'incident_assistant.suggestions.timers', question: 'What timers are running?' },
} as const;

const GENERAL: IncidentPlaybook = {
  type: 'General',
  displayName: 'Incident',
  keywords: ['incident'],
  benchmarks: ['Command established', 'Initial size-up transmitted', 'Incident action plan set', 'Accountability in place', 'Incident under control'],
  checklist: [
    'Command established, announced, and passed to dispatch',
    'Command post location set and shared with incoming resources',
    'Initial size-up / CAN report (Conditions, Actions, Needs) transmitted',
    'Incident action plan recorded on the board',
    'Safety Officer assigned once the incident is working',
    'Accountability (PAR) timer running',
    'Staging designated and a Staging Area Manager assigned as resources build',
    'Span of control kept to 3-7 resources per supervisor',
    'Rehab established for extended operations',
    'Operational period and transfer-of-command plan set for a long incident',
  ],
  keyRoles: [IncidentRoleType.IncidentCommander, IncidentRoleType.SafetyOfficer],
  suggestions: [SUGGESTION.par, SUGGESTION.status, SUGGESTION.openObjectives, SUGGESTION.span, SUGGESTION.missing],
};

const PLAYBOOKS: IncidentPlaybook[] = [
  {
    type: 'StructureFire',
    displayName: 'Structure fire',
    keywords: [
      'structure fire',
      'house fire',
      'building fire',
      'residential fire',
      'commercial fire',
      'apartment fire',
      'working fire',
      'room and contents',
      'chimney fire',
      'attic fire',
      'basement fire',
      'smoke in the structure',
      'fire alarm',
      'structure',
    ],
    benchmarks: ['360 complete', 'Water supply established', 'Primary search all clear', 'Fire under control', 'Secondary search all clear', 'Utilities secured', 'Loss stopped', 'Overhaul complete'],
    checklist: [
      '360 size-up completed and the report transmitted',
      'Water supply established and confirmed',
      'Primary search assigned, with the all-clear reported back',
      'RIT / RIC assigned and in position before crews go interior',
      'Ventilation coordinated with the attack line, not ahead of it',
      'Utilities (gas and electric) secured',
      'Exposures checked and protected',
      '20-minute PAR benchmarks running from the time of arrival',
      'Rehab established for crews rotating out',
      'Secondary search assigned once the fire is under control',
      'Fire investigator requested before overhaul destroys the origin area',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.OperationsSectionChief,
      IncidentRoleType.DivisionGroupSupervisor,
      IncidentRoleType.StagingAreaManager,
      IncidentRoleType.RehabOfficer,
    ],
    suggestions: [SUGGESTION.par, SUGGESTION.rit, SUGGESTION.openObjectives, SUGGESTION.onScene, SUGGESTION.missing],
  },
  {
    type: 'Wildland',
    displayName: 'Wildland fire',
    keywords: ['wildland', 'wild land', 'brush fire', 'brush', 'grass fire', 'vegetation fire', 'wildfire', 'forest fire', 'timber', 'red flag', 'field fire', 'woods fire'],
    benchmarks: ['LCES briefed', 'Anchor point established', 'Line construction started', 'Structure triage complete', 'Containment percentage reported', 'Fire contained', 'Fire controlled'],
    checklist: [
      'LCES briefed to every division: Lookouts, Communications, Escape routes, Safety zones',
      'Anchor point established before any line construction',
      'Current and forecast wind, humidity and temperature checked',
      'Fire weather watch / red flag warning checked for the burn period',
      'Structure triage assigned for threatened structures',
      'Evacuation warnings and orders coordinated with law enforcement',
      'Air operations coordinated, with an Air Operations Branch Director once aircraft are working',
      'Acreage and containment percentage tracked for the ICS-209',
      'Divisions assigned by geography, each with a named supervisor',
      'Water tender / supply shuttle plan set',
      'Operational period and written IAP set — wildland incidents outlast the first crews',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.OperationsSectionChief,
      IncidentRoleType.DivisionGroupSupervisor,
      IncidentRoleType.PlanningSectionChief,
      IncidentRoleType.LogisticsSectionChief,
      IncidentRoleType.AirOperationsBranchDirector,
    ],
    suggestions: [SUGGESTION.wind, SUGGESTION.par, SUGGESTION.span, SUGGESTION.openNeeds, SUGGESTION.missing],
  },
  {
    type: 'VehicleAccident',
    displayName: 'Vehicle accident',
    keywords: [
      'mva',
      'mvc',
      'vehicle accident',
      'vehicle collision',
      'traffic collision',
      'car accident',
      'auto accident',
      'rollover',
      'pin in',
      'entrapment',
      'extrication',
      'vehicle vs',
      'car vs',
      'motorcycle accident',
      'vehicle fire',
      'car fire',
      'tc with',
    ],
    benchmarks: ['Scene stabilized', 'Traffic control established', 'Patient count confirmed', 'Extrication complete', 'All patients transported', 'Roadway released'],
    checklist: [
      'Blocking apparatus positioned upstream, wheels turned away from the work area',
      'Patient count confirmed and transmitted',
      'Vehicles stabilized before anyone works in or under them',
      'Hazards checked: fuel, battery, undeployed airbags, hybrid/EV high voltage, cargo',
      'Extrication group assigned with a stated plan and a backup plan',
      'Transport resources requested to match the confirmed patient count',
      'Air medical requested early and a landing zone secured if transport time drives it',
      'Law enforcement notified for investigation and roadway closure',
      'Fluid containment and clean-up arranged before the roadway is released',
    ],
    keyRoles: [IncidentRoleType.IncidentCommander, IncidentRoleType.SafetyOfficer, IncidentRoleType.OperationsSectionChief, IncidentRoleType.TriageOfficer, IncidentRoleType.TransportOfficer],
    suggestions: [SUGGESTION.onScene, SUGGESTION.openObjectives, SUGGESTION.par, SUGGESTION.unfilledRoles, SUGGESTION.missing],
  },
  {
    type: 'Ems',
    displayName: 'EMS incident',
    keywords: [
      'ems',
      'medical',
      'sick person',
      'chest pain',
      'cardiac',
      'cardiac arrest',
      'stroke',
      'overdose',
      'od',
      'fall',
      'difficulty breathing',
      'unconscious',
      'unresponsive',
      'seizure',
      'diabetic',
      'allergic reaction',
      'lift assist',
      'bleeding',
      'trauma',
    ],
    benchmarks: ['Patient contact made', 'ALS on scene', 'Transport decision made', 'Patient transported'],
    checklist: [
      'Scene safety confirmed; staged clear if the scene is not secured',
      'Patient count confirmed',
      'ALS resource on scene or en route when the patient’s condition needs it',
      'Receiving facility notified early for time-critical patients (STEMI, stroke, trauma)',
      'Air medical considered when ground transport time is the limiting factor',
      'Extra hands requested for lift assist, long carry-out or difficult access',
      'Law enforcement requested for violence, weapons or a crime scene',
      'Family and bystander management assigned on a working code',
    ],
    keyRoles: [IncidentRoleType.IncidentCommander, IncidentRoleType.MedicalUnitLeader, IncidentRoleType.TransportOfficer],
    suggestions: [SUGGESTION.onScene, SUGGESTION.status, SUGGESTION.openObjectives, SUGGESTION.par, SUGGESTION.missing],
  },
  {
    type: 'MassCasualty',
    displayName: 'Mass casualty incident',
    keywords: ['mci', 'mass casualty', 'mass cas', 'multi casualty', 'multiple patients', 'bus accident', 'bus crash', 'train derailment', 'multiple victims'],
    benchmarks: ['MCI declared', 'Triage complete', 'Treatment area established', 'Transport officer tracking', 'All immediate patients transported', 'All patients transported'],
    checklist: [
      'MCI declared and the level passed to dispatch',
      'Triage, Treatment and Transport Officers assigned',
      'START / SALT triage complete with counts by category (Immediate, Delayed, Minor, Deceased)',
      'Treatment area and casualty collection point established clear of the hazard',
      'Ambulance staging and a one-way transport corridor separated from the incoming route',
      'Hospital capability / bed poll requested and patients distributed across facilities',
      'Patient tracking in place — every patient’s destination recorded',
      'Additional transport, mutual aid and buses requested early rather than late',
      'Medical Branch Director assigned once triage exceeds span of control',
      'Family reunification point and a single public-information release point established',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.MedicalBranchDirector,
      IncidentRoleType.TriageOfficer,
      IncidentRoleType.TreatmentOfficer,
      IncidentRoleType.TransportOfficer,
      IncidentRoleType.StagingAreaManager,
      IncidentRoleType.PublicInformationOfficer,
    ],
    suggestions: [SUGGESTION.unfilledRoles, SUGGESTION.openNeeds, SUGGESTION.onScene, SUGGESTION.par, SUGGESTION.missing],
  },
  {
    type: 'HazMat',
    displayName: 'HazMat incident',
    keywords: [
      'hazmat',
      'haz mat',
      'hazardous material',
      'chemical spill',
      'chemical leak',
      'gas leak',
      'natural gas',
      'propane leak',
      'fuel spill',
      'unknown odor',
      'odor of gas',
      'carbon monoxide',
      'co alarm',
      'radiological',
      'biological',
      'decon',
      'tanker rollover',
    ],
    benchmarks: ['Product identified', 'Zones established', 'Decon operational', 'Isolation distance set', 'Product controlled', 'Scene turned over'],
    checklist: [
      'Approached and staged upwind and uphill, outside the hot zone',
      'Product identified (placard, UN number, SDS) and the ERG isolation distance applied',
      'Hot, warm and cold zones established and physically marked',
      'Decon corridor operational BEFORE any entry team makes entry',
      'Entry team, backup team, entry time and air supply tracked',
      'HazMat Group Supervisor and Decon Officer assigned',
      'Downwind population identified; evacuate or shelter-in-place decision made',
      'Wind direction and forecast checked, and re-checked as the incident runs',
      'Technical reference, shipper and responsible party contacted',
      'Environmental agency and clean-up contractor notified',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.OperationsSectionChief,
      IncidentRoleType.HazMatGroupSupervisor,
      IncidentRoleType.DeconOfficer,
      IncidentRoleType.EntryTeamLeader,
    ],
    suggestions: [SUGGESTION.wind, SUGGESTION.unfilledRoles, SUGGESTION.openObjectives, SUGGESTION.par, SUGGESTION.missing],
  },
  {
    type: 'NaturalDisaster',
    displayName: 'Natural disaster',
    keywords: ['flood', 'flooding', 'tornado', 'hurricane', 'typhoon', 'earthquake', 'storm damage', 'severe weather', 'ice storm', 'blizzard', 'mudslide', 'landslide', 'wind damage', 'tsunami', 'disaster'],
    benchmarks: ['Life safety sweep started', 'Damage assessment started', 'Shelters opened', 'Utilities coordinated', 'Operational period published'],
    checklist: [
      'Life-safety sweep of the affected area assigned by division / geography',
      'Damage assessment teams assigned and reporting on a schedule',
      'Shelter and mass-care coordination started with partner agencies',
      'EOC activated, or a liaison established with the jurisdiction’s EOC',
      'Utility companies engaged for downed lines, gas and water',
      'Road closures, access routes and staging mapped for incoming resources',
      'Operational periods declared — this incident will outlast the first crews',
      'Logistics plan for fuel, food, rest and relief crews',
      'Documentation Unit tracking costs and resource time for reimbursement',
      'Single public-information release point established',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.OperationsSectionChief,
      IncidentRoleType.PlanningSectionChief,
      IncidentRoleType.LogisticsSectionChief,
      IncidentRoleType.LiaisonOfficer,
      IncidentRoleType.PublicInformationOfficer,
      IncidentRoleType.ShelterMassCareCoordinator,
      IncidentRoleType.DamageAssessmentLead,
    ],
    suggestions: [SUGGESTION.unfilledRoles, SUGGESTION.span, SUGGESTION.openNeeds, SUGGESTION.status, SUGGESTION.missing],
  },
  {
    type: 'SearchAndRescue',
    displayName: 'Search and rescue',
    keywords: ['search and rescue', 'sar', 'missing person', 'missing child', 'missing subject', 'lost hiker', 'overdue hiker', 'overdue', 'walkaway', 'despondent', 'wandering', 'lost person', 'search'],
    benchmarks: ['Last known point established', 'Containment established', 'Hasty search complete', 'Segments assigned', 'Subject located'],
    checklist: [
      'Last known point / point last seen established and time-stamped',
      'Subject profile built: age, medical, clothing, experience, intent',
      'Containment set — trailheads, roads and perimeter covered before the search area grows',
      'Hasty teams pushed into the high-probability areas first',
      'Search segments defined, assigned and tracked with coverage / probability of detection',
      'Radio check schedule for every field team, with an overdue trigger',
      'Clue log maintained and every clue investigated and located',
      'Air, K9, drone and technical resources requested early',
      'Cell phone ping / forensics requested through law enforcement',
      'Operational period, night operations and relief teams planned',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.OperationsSectionChief,
      IncidentRoleType.SearchGroupSupervisor,
      IncidentRoleType.PlanningSectionChief,
      IncidentRoleType.LogisticsSectionChief,
    ],
    suggestions: [SUGGESTION.onScene, SUGGESTION.openObjectives, SUGGESTION.par, SUGGESTION.recent, SUGGESTION.missing],
  },
  {
    type: 'TechnicalRescue',
    displayName: 'Technical rescue',
    keywords: [
      'technical rescue',
      'confined space',
      'trench',
      'trench collapse',
      'high angle',
      'rope rescue',
      'machinery entrapment',
      'structural collapse',
      'collapse rescue',
      'elevator rescue',
      'industrial accident',
      'silo',
      'grain bin',
    ],
    benchmarks: ['Scene secured', 'Atmosphere monitored', 'Rescue versus recovery declared', 'Patient contact made', 'Patient extricated', 'All crews out and accounted for'],
    checklist: [
      'Rescue versus recovery decision made and announced to everyone working',
      'Atmospheric monitoring and ventilation done before any confined-space entry',
      'Lock-out / tag-out of machinery and every energy source',
      'Trench: shoring in place and spoil pile set back — nobody enters an unprotected trench',
      'Technical rescue team requested; untrained crews are not committed',
      'Dedicated backup team and a safety officer assigned to the rescue itself',
      'Patient packaging plan set and a transport resource on scene',
      'Structural engineer and utility support requested for a collapse',
    ],
    keyRoles: [IncidentRoleType.IncidentCommander, IncidentRoleType.SafetyOfficer, IncidentRoleType.OperationsSectionChief, IncidentRoleType.EntryTeamLeader],
    suggestions: [SUGGESTION.par, SUGGESTION.safety, SUGGESTION.openObjectives, SUGGESTION.onScene, SUGGESTION.missing],
  },
  {
    type: 'WaterRescue',
    displayName: 'Water rescue',
    keywords: ['water rescue', 'swift water', 'swiftwater', 'drowning', 'capsized', 'boat in distress', 'ice rescue', 'dive rescue', 'person in the water', 'flood rescue'],
    benchmarks: ['Downstream containment established', 'Rescue resources deployed', 'Subject located', 'All crews accounted for'],
    checklist: [
      'Reach, throw, row, go — the lowest-risk option that works is the right one',
      'Downstream containment and backup established before any in-water attempt',
      'PFDs and throw bags on everyone working at the water’s edge',
      'Rescue versus recovery decision made, with time in the water tracked',
      'Boat, dive and helicopter resources requested early',
      'Upstream spotter posted for debris and changing flow',
    ],
    keyRoles: [IncidentRoleType.IncidentCommander, IncidentRoleType.SafetyOfficer, IncidentRoleType.OperationsSectionChief],
    suggestions: [SUGGESTION.par, SUGGESTION.onScene, SUGGESTION.openObjectives, SUGGESTION.status, SUGGESTION.missing],
  },
  {
    type: 'ActiveThreat',
    displayName: 'Active threat',
    keywords: ['active shooter', 'active threat', 'shooting', 'shots fired', 'stabbing', 'hostile event', 'bomb threat', 'explosion', 'civil unrest', 'violent incident'],
    benchmarks: ['Unified command established', 'Staging established', 'Casualty collection point established', 'Patients transported', 'Scene turned over to law enforcement'],
    checklist: [
      'Unified Command established with law enforcement',
      'Staging set well away from the scene and out of line of sight',
      'Warm and cold zones defined by law enforcement — nothing enters the hot zone',
      'Rescue Task Forces formed with force protection if the model is in use',
      'Casualty collection point and an evacuation corridor established',
      'Hemorrhage-control supplies pushed forward to the point of injury',
      'Hospitals notified of a mass-casualty penetrating-trauma event',
      'Secondary device / secondary threat considered before crews are committed',
      'Reunification, public information and behavioral health support started early',
    ],
    keyRoles: [
      IncidentRoleType.IncidentCommander,
      IncidentRoleType.UnifiedCommandMember,
      IncidentRoleType.SafetyOfficer,
      IncidentRoleType.MedicalBranchDirector,
      IncidentRoleType.TriageOfficer,
      IncidentRoleType.TransportOfficer,
      IncidentRoleType.LiaisonOfficer,
      IncidentRoleType.PublicInformationOfficer,
    ],
    suggestions: [SUGGESTION.unfilledRoles, SUGGESTION.par, SUGGESTION.onScene, SUGGESTION.recent, SUGGESTION.missing],
  },
];

export const generalPlaybook = GENERAL;

export const allPlaybooks: IncidentPlaybook[] = [GENERAL, ...PLAYBOOKS];

export const getPlaybook = (type: IncidentPlaybookType): IncidentPlaybook => (type === 'General' ? GENERAL : (PLAYBOOKS.find((p) => p.type === type) ?? GENERAL));

/** Resolves a playbook from free text the commander typed ("structure fire", "mci"). Null when nothing matches. */
export const resolvePlaybook = (text?: string | null): IncidentPlaybook | null => {
  if (!text) {
    return null;
  }
  const needle = text.trim().toLowerCase();
  if (!needle) {
    return null;
  }

  return PLAYBOOKS.find((playbook) => playbook.displayName.toLowerCase() === needle || playbook.keywords.some((keyword) => needle.includes(keyword))) ?? null;
};

/**
 * Infers the incident family from whatever the app knows about the call. Longer keyword matches win
 * so "vehicle fire" beats a bare "fire"; falls back to the general playbook when nothing scores.
 */
export const inferPlaybook = (parts: (string | null | undefined)[]): IncidentPlaybook => {
  const haystack = parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) {
    return GENERAL;
  }

  let best: IncidentPlaybook | null = null;
  let bestScore = 0;

  for (const playbook of PLAYBOOKS) {
    const score = playbook.keywords.reduce((max, keyword) => (haystack.includes(keyword) ? Math.max(max, keyword.length) : max), 0);
    if (score > bestScore) {
      bestScore = score;
      best = playbook;
    }
  }

  return best ?? GENERAL;
};

/** The checklist to work from: type-specific items followed by the universal ones. */
export const checklistFor = (playbook: IncidentPlaybook): string[] => (playbook.type === 'General' ? GENERAL.checklist : [...playbook.checklist, ...GENERAL.checklist]);

/** Positions worth having filled: type-specific plus the universal ones, de-duplicated. */
export const keyRolesFor = (playbook: IncidentPlaybook): IncidentRoleType[] => Array.from(new Set([...playbook.keyRoles, ...GENERAL.keyRoles]));
