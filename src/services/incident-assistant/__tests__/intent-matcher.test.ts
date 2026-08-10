import { matchIncidentIntent } from '../intent-matcher';

describe('matchIncidentIntent', () => {
  it('recognizes the shorthand an IC actually uses for a PAR', () => {
    ['PAR', 'par check', 'accountability', 'give me a PAR', 'run a par check', "who's overdue?"].forEach((question) => {
      const match = matchIncidentIntent(question);
      expect(match.intent).toBe('par');
      expect(match.confidence).toBe(1);
    });
  });

  it('scopes a lane question to the lane that was named', () => {
    expect(matchIncidentIntent('who is working Division A')).toMatchObject({ intent: 'resources', params: { laneName: 'Division A' } });
    expect(matchIncidentIntent("what's in staging?")).toMatchObject({ intent: 'resources', params: { laneName: 'staging' } });
  });

  it('treats an unassigned question as the resource pool', () => {
    expect(matchIncidentIntent('who is unassigned')).toMatchObject({ intent: 'resources', params: { laneName: 'unassigned' } });
  });

  it('separates span of control from a general resource question', () => {
    expect(matchIncidentIntent('span of control').intent).toBe('span_of_control');
    expect(matchIncidentIntent('which lanes are over staffed').intent).toBe('span_of_control');
    expect(matchIncidentIntent('what resources do I have on scene').intent).toBe('resources');
  });

  it('resolves ICS position questions and leaves ordinary name lookups alone', () => {
    expect(matchIncidentIntent('who is the safety officer')).toMatchObject({ intent: 'roles', params: { roleQuery: 'safety officer' } });
    expect(matchIncidentIntent('do we have a staging area manager?')).toMatchObject({ intent: 'roles', params: { roleQuery: 'staging area manager' } });
    // A person's name is not an ICS position, so this must not be captured as a role query.
    expect(matchIncidentIntent('who is Jordan Rivera').intent).not.toBe('roles');
  });

  it('normalizes a timeline window to minutes', () => {
    expect(matchIncidentIntent('what happened in the last 30 minutes')).toMatchObject({ intent: 'timeline', params: { minutes: 30 } });
    expect(matchIncidentIntent('what happened in the last 2 hours')).toMatchObject({ intent: 'timeline', params: { minutes: 120 } });
    expect(matchIncidentIntent('show me the last 5 log entries')).toMatchObject({ intent: 'timeline', params: { count: 5 } });
  });

  it('picks up objectives, needs, timers, notes, briefing and checklist questions', () => {
    expect(matchIncidentIntent('what objectives are still open').intent).toBe('objectives');
    expect(matchIncidentIntent('what needs are open').intent).toBe('needs');
    expect(matchIncidentIntent('what am I waiting on').intent).toBe('needs');
    expect(matchIncidentIntent('what timers are running').intent).toBe('timers');
    expect(matchIncidentIntent('incident notes').intent).toBe('notes');
    expect(matchIncidentIntent('give me a transfer of command briefing').intent).toBe('briefing');
    expect(matchIncidentIntent('what am I missing').intent).toBe('checklist');
    expect(matchIncidentIntent('checklist for a structure fire')).toMatchObject({ intent: 'checklist', params: { incidentType: 'structure fire' } });
  });

  it('routes weather questions out to the server, which is the only side with live conditions', () => {
    expect(matchIncidentIntent('what is the wind doing').intent).toBe('weather');
    expect(matchIncidentIntent('weather at the scene').intent).toBe('weather');
  });

  it('falls back to status for a general "how are we doing" question', () => {
    expect(matchIncidentIntent('incident status').intent).toBe('status');
    expect(matchIncidentIntent('size-up').intent).toBe('status');
    expect(matchIncidentIntent('where do we stand').intent).toBe('status');
  });

  it('tolerates trailing punctuation without losing the parameter', () => {
    expect(matchIncidentIntent('who is working Division B?')).toMatchObject({ intent: 'resources', params: { laneName: 'Division B' } });
  });

  it('returns unknown for something outside the incident domain', () => {
    const match = matchIncidentIntent('what is the airspeed velocity of an unladen swallow');
    expect(match.intent).toBe('unknown');
    expect(match.confidence).toBe(0);
  });

  it('scores a keyword-only phrasing below an anchored match so callers can prefer the server', () => {
    const match = matchIncidentIntent('can you get me an accountability rundown for the crews');
    expect(match.intent).toBe('par');
    expect(match.confidence).toBeLessThan(1);
  });
});
