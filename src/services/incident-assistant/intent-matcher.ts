/**
 * On-device intent matching for the command-board assistant.
 *
 * Mirrors the incident-command patterns in Core's `KeywordIntentClassifier` so the phone recognizes
 * the same questions the server does — the point being that when the scene has no signal, the
 * commander still gets an answer from the board already cached on the device.
 *
 * English-only by design, matching the backend classifier: commands and one-tap prompts are canonical
 * English strings even when the UI is localized (the chips display a translated label but send the
 * English question). See `ics-playbooks.ts`.
 */

/** What the assistant understood the question to be. */
export type IncidentAssistantIntent = 'status' | 'par' | 'resources' | 'span_of_control' | 'objectives' | 'needs' | 'roles' | 'timeline' | 'timers' | 'notes' | 'briefing' | 'checklist' | 'weather' | 'unknown';

export interface IncidentIntentParams {
  /** Lane the question scoped to ("division a"), or the literal "unassigned". */
  laneName?: string;
  /** ICS position asked about ("safety officer", "rit"). */
  roleQuery?: string;
  /** How far back to read the incident log, in minutes. */
  minutes?: number;
  /** How many log entries to read. */
  count?: number;
  /** Incident family named explicitly ("structure fire"), overriding the inferred one. */
  incidentType?: string;
}

export interface IncidentIntentMatch {
  intent: IncidentAssistantIntent;
  /** 1 for an anchored pattern hit, lower for the fuzzy keyword fallback, 0 for no match. */
  confidence: number;
  params: IncidentIntentParams;
}

type Extractor = (match: RegExpMatchArray) => IncidentIntentParams;

interface Pattern {
  regex: RegExp;
  intent: IncidentAssistantIntent;
  extract?: Extractor;
}

/**
 * ICS position vocabulary. Role lookups only fire on an actual position name so "who is Smith" stays
 * an ordinary personnel question rather than being swallowed as a role query.
 */
const ROLE_WORDS =
  '(ic|incident\\s+commander|deputy(\\s+incident)?(\\s+commander)?|commander|unified\\s+command|safety(\\s+officer)?|' +
  'ops(\\s+chief)?|operations(\\s+section)?(\\s+chief)?|planning(\\s+section)?(\\s+chief)?|logistics(\\s+section)?(\\s+chief)?|' +
  'finance(\\s+admin)?(\\s+section)?(\\s+chief)?|pio|public\\s+information\\s+officer|liaison(\\s+officer)?|' +
  'staging(\\s+area)?\\s+manager|resources?\\s+unit\\s+leader|situation\\s+unit\\s+leader|documentation\\s+unit\\s+leader|' +
  'communications\\s+unit\\s+leader|division\\s+supervisor|group\\s+supervisor|branch\\s+director|' +
  'strike\\s+team\\s+leader|task\\s+force\\s+leader|medical\\s+unit\\s+leader|rehab(\\s+officer)?|medical\\s+branch\\s+director|' +
  'triage(\\s+officer)?|treatment(\\s+officer)?|transport(\\s+officer)?|hazmat\\s+group\\s+supervisor|decon(\\s+officer)?|' +
  'entry\\s+team\\s+leader|search\\s+group\\s+supervisor|air\\s+operations(\\s+branch)?(\\s+director)?|' +
  'shelter(\\s+mass\\s+care)?\\s+coordinator|mass\\s+care\\s+coordinator|damage\\s+assessment\\s+lead|' +
  'rit|ric|rapid\\s+intervention(\\s+team|\\s+crew)?|accountability\\s+officer)';

const r = (source: string): RegExp => new RegExp(source, 'i');

const laneNameFrom = (nodeWord?: string, remainder?: string): string => {
  const designator = (remainder ?? '').trim().replace(/[?!.,]+$/, '');
  const word = (nodeWord ?? '').trim();
  return designator ? `${word} ${designator}`.trim() : word;
};

const toMinutes = (amount?: string, unit?: string): number | undefined => {
  const value = parseInt((amount ?? '').trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return (unit ?? '').trim().toLowerCase().startsWith('h') ? value * 60 : value;
};

const toCount = (raw?: string): number | undefined => {
  const value = parseInt((raw ?? '').trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Ordered: the first match wins, so the sharper questions come before the broad ones. Kept in the
 * same order as the backend's incident block for exactly the same reason.
 */
const PATTERNS: Pattern[] = [
  // --- PAR / accountability ---
  { regex: r('^(par|par\\s+check|accountability|accountability\\s+check|personnel\\s+accountability(\\s+report)?)$'), intent: 'par' },
  { regex: r('^(give|get|run|do)\\s+(me\\s+)?(a\\s+|the\\s+)?par(\\s+check)?$'), intent: 'par' },
  { regex: r("^(who'?s|who\\s+is|who\\s+are|anyone)\\s+(overdue|unaccounted(\\s+for)?|not\\s+accounted\\s+for|missing)(\\s+.*)?$"), intent: 'par' },

  // --- Span of control (before the generic resource questions) ---
  { regex: r('^span(\\s+of\\s+control)?(\\s+check)?$'), intent: 'span_of_control' },
  { regex: r('^(what|which)\\s+(lanes?|divisions?|groups?|branches|sectors?)\\s+(are\\s+)?(over|under)\\s*-?\\s*(staffed|filled|loaded|manned|resourced)?$'), intent: 'span_of_control' },
  { regex: r('^(am\\s+i|are\\s+we)\\s+(over|under)\\s*-?\\s*(staffed|filled|loaded|manned|resourced)$'), intent: 'span_of_control' },

  // --- Resources ---
  {
    regex: r("^(who'?s|who\\s+is|who\\s+are|what'?s|what\\s+is|what)\\s+(assigned\\s+to|working|in|on)\\s+(division|group|branch|sector|strike\\s+team|task\\s+force|staging|lane)\\s*(.*)$"),
    intent: 'resources',
    extract: (m) => ({ laneName: laneNameFrom(m[3], m[4]) }),
  },
  {
    regex: r('^(what|which)\\s+(resources|units?|crews?|companies|apparatus|personnel)\\s+(do\\s+i\\s+have|do\\s+we\\s+have|are|is)\\s+(on\\s*scene|assigned|working|committed|on\\s+(?:the\\s+)?incident)(\\s+.*)?$'),
    intent: 'resources',
  },
  { regex: r('^(incident\\s+)?(resources|assignments|resource\\s+list)$'), intent: 'resources' },
  { regex: r('^(what|who)\\s+(do\\s+i|do\\s+we)\\s+have\\s+(on\\s*scene|working|committed|assigned)(\\s+.*)?$'), intent: 'resources' },
  { regex: r("^(who'?s|who\\s+is|what'?s|what\\s+is|what)\\s+(un|not\\s+)assigned$"), intent: 'resources', extract: () => ({ laneName: 'unassigned' }) },

  // --- Objectives / benchmarks ---
  { regex: r('^(incident\\s+)?(objectives?|benchmarks?|tactical\\s+objectives?)$'), intent: 'objectives' },
  { regex: r('^(what|which)\\s+(objectives?|benchmarks?)\\s+(are\\s+)?(open|outstanding|incomplete|remaining|left|still\\s+open|not\\s+(?:done|complete))$'), intent: 'objectives' },
  { regex: r("^(what'?s|what\\s+is)\\s+(still\\s+)?(open|outstanding|left|remaining|incomplete)(\\s+on\\s+(?:the\\s+|this\\s+)?(incident|scene|board))?$"), intent: 'objectives' },
  { regex: r("^(what'?s|what\\s+is)\\s+(my|our|the)\\s+next\\s+benchmark$"), intent: 'objectives' },

  // --- Needs / resource orders ---
  { regex: r('^(incident\\s+)?(needs?|resource\\s+orders?|orders?)$'), intent: 'needs' },
  { regex: r('^(what|which)\\s+(needs?|orders?|requests?)\\s+(are\\s+)?(open|unfilled|outstanding|pending|not\\s+(?:met|filled))$'), intent: 'needs' },
  { regex: r('^what\\s+(did|have)\\s+(i|we)\\s+order(ed)?(\\s+.*)?$'), intent: 'needs' },
  { regex: r("^(what'?s|what\\s+is)\\s+(not\\s+)?(been\\s+)?(filled|met|arrived)$"), intent: 'needs' },
  { regex: r('^what\\s+(am\\s+i|are\\s+we)\\s+(waiting\\s+on|short\\s+on|short)$'), intent: 'needs' },

  // --- ICS positions ---
  { regex: r('^(ics\\s+)?(roles?|positions?|command\\s+staff|general\\s+staff)$'), intent: 'roles' },
  { regex: r(`^(who'?s|who\\s+is|who\\s+has)\\s+(my|the|our)?\\s*${ROLE_WORDS}\\s*\\??$`), intent: 'roles', extract: (m) => ({ roleQuery: (m[3] ?? '').trim() }) },
  { regex: r('^(what|which)\\s+(ics\\s+)?(roles?|positions?)\\s+(are\\s+)?(unfilled|open|vacant|empty|not\\s+assigned|missing)$'), intent: 'roles' },
  { regex: r(`^(do\\s+i|do\\s+we|have\\s+i|have\\s+we)\\s+(have|got|assigned)\\s+(an?\\s+)?${ROLE_WORDS}\\s*\\??$`), intent: 'roles', extract: (m) => ({ roleQuery: (m[4] ?? '').trim() }) },

  // --- Incident (ICS-201) log ---
  { regex: r('^(incident\\s+)?(timeline|incident\\s+log|command\\s+log|log)$'), intent: 'timeline' },
  {
    regex: r('^what\\s+(has\\s+)?happened(\\s+(?:in\\s+)?(?:the\\s+)?last\\s+(\\d+)\\s*(minutes?|mins?|hours?|hrs?))?(\\s+.*)?$'),
    intent: 'timeline',
    extract: (m) => ({ minutes: toMinutes(m[3], m[4]) }),
  },
  { regex: r('^(read|show|give|list)\\s+(me\\s+)?(the\\s+)?last\\s+(\\d+)\\s+(log\\s+)?(entries|entry|events)$'), intent: 'timeline', extract: (m) => ({ count: toCount(m[4]) }) },

  // --- Timers ---
  { regex: r('^(incident\\s+)?timers?$'), intent: 'timers' },
  { regex: r('^(what|which)\\s+timers?\\s+(are\\s+)?(running|due|up|active)$'), intent: 'timers' },
  { regex: r("^(what'?s|what\\s+is|when'?s|when\\s+is)\\s+(my|the|our)\\s+next\\s+(par|check\\s*-?\\s*in|timer)(\\s+.*)?$"), intent: 'timers' },

  // --- Briefing / transfer of command ---
  { regex: r('^(briefing|brief\\s+me|transfer\\s+of\\s+command|ics\\s*-?\\s*201|command\\s+brief(ing)?)$'), intent: 'briefing' },
  {
    regex: r('^(give|draft|write|prepare|build|make)\\s+(me\\s+)?(a\\s+|the\\s+)?(briefing|brief|transfer\\s+of\\s+command(\\s+briefing)?|ics\\s*-?\\s*201|hand\\s*-?\\s*off(\\s+briefing)?)$'),
    intent: 'briefing',
  },

  // --- Checklist / playbook ---
  { regex: r("^(checklist|playbook|what\\s+am\\s+i\\s+missing|what\\s+are\\s+we\\s+missing|what'?s\\s+next)$"), intent: 'checklist' },
  { regex: r('^(what|anything)\\s+(am\\s+i|are\\s+we)\\s+(missing|forgetting)(\\s+.*)?$'), intent: 'checklist' },
  { regex: r('^what\\s+should\\s+(i|we)\\s+(be\\s+)?(doing|do|consider|think\\s+about)(\\s+.*)?$'), intent: 'checklist' },
  { regex: r('^(checklist|playbook)\\s+(?:for\\s+)?(?:an?\\s+)?(.+)$'), intent: 'checklist', extract: (m) => ({ incidentType: (m[2] ?? '').trim() }) },

  // --- Weather at the incident ---
  { regex: r('^(incident\\s+weather|scene\\s+weather|weather\\s+(?:at|on)\\s+(?:the\\s+)?(?:scene|incident|icp|command\\s+post))$'), intent: 'weather' },
  { regex: r("^(what'?s|what\\s+is)\\s+(the\\s+)?(wind|weather)\\s*(doing|at\\s+(?:the\\s+)?(?:scene|incident|icp))?$"), intent: 'weather' },
  { regex: r('^(wind|wind\\s+direction|wind\\s+speed)$'), intent: 'weather' },

  // --- Status notes ---
  { regex: r('^(incident\\s+)?(notes|situation\\s+updates?)$'), intent: 'notes' },
  { regex: r('^(what|any)\\s+(notes|situation\\s+updates?)(\\s+.*)?$'), intent: 'notes' },

  // --- Overall status / size-up (last so sharper questions win) ---
  { regex: r('^(incident|command|scene)\\s+(status|summary|snapshot|overview)$'), intent: 'status' },
  { regex: r('^(size\\s*-?\\s*up|sizeup|sitrep|situation\\s+report|can\\s+report|status\\s+board)$'), intent: 'status' },
  { regex: r("^(what'?s|what\\s+is)\\s+(the\\s+)?(status|situation|picture)\\s+(of|on|at)\\s+(the\\s+|this\\s+)?(incident|command|scene|call)$"), intent: 'status' },
  { regex: r('^(where\\s+(do|are)\\s+we\\s+(stand|at)|how\\s+are\\s+we\\s+doing)$'), intent: 'status' },
];

/**
 * Low-confidence keyword sweep for phrasings the anchored patterns miss. Scored below 1 so the caller
 * can decide to prefer a server answer when it has a connection.
 */
const fuzzyMatch = (lower: string): IncidentIntentMatch | null => {
  if (lower.includes('par') || lower.includes('accountab')) {
    return { intent: 'par', confidence: 0.6, params: {} };
  }
  if (lower.includes('objective') || lower.includes('benchmark')) {
    return { intent: 'objectives', confidence: 0.6, params: {} };
  }
  if (lower.includes('need') || lower.includes('order')) {
    return { intent: 'needs', confidence: 0.5, params: {} };
  }
  if (lower.includes('wind') || lower.includes('weather')) {
    return { intent: 'weather', confidence: 0.6, params: {} };
  }
  if (lower.includes('timer')) {
    return { intent: 'timers', confidence: 0.6, params: {} };
  }
  if (lower.includes('log') || lower.includes('timeline') || lower.includes('happened')) {
    return { intent: 'timeline', confidence: 0.5, params: {} };
  }
  if (lower.includes('brief') || lower.includes('201') || lower.includes('transfer of command')) {
    return { intent: 'briefing', confidence: 0.6, params: {} };
  }
  if (lower.includes('checklist') || lower.includes('missing')) {
    return { intent: 'checklist', confidence: 0.5, params: {} };
  }
  if (lower.includes('resource') || lower.includes('assigned') || lower.includes('on scene')) {
    return { intent: 'resources', confidence: 0.5, params: {} };
  }
  if (lower.includes('span')) {
    return { intent: 'span_of_control', confidence: 0.5, params: {} };
  }
  if (lower.includes('role') || lower.includes('position') || lower.includes('officer')) {
    return { intent: 'roles', confidence: 0.5, params: {} };
  }

  return null;
};

/** Classifies a command-board question entirely on-device. */
export const matchIncidentIntent = (question: string): IncidentIntentMatch => {
  const trimmed = (question ?? '').trim();
  if (!trimmed) {
    return { intent: 'unknown', confidence: 0, params: {} };
  }

  // Commanders punctuate ("PAR?"). Try the raw text first so free-form parameters keep their
  // punctuation, then a stripped copy — the same two-pass the backend classifier uses.
  const stripped = trimmed.replace(/[?!.,\s]+$/, '');
  const candidates = stripped.length > 0 && stripped !== trimmed ? [trimmed, stripped] : [trimmed];

  for (const pattern of PATTERNS) {
    for (const candidate of candidates) {
      const match = candidate.match(pattern.regex);
      if (match) {
        return { intent: pattern.intent, confidence: 1, params: pattern.extract ? pattern.extract(match) : {} };
      }
    }
  }

  return fuzzyMatch(trimmed.toLowerCase()) ?? { intent: 'unknown', confidence: 0, params: {} };
};
