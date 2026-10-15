import { CallTypeClasses } from '@/lib/base-types';

import { type IncidentAnswerContext, playbookFor } from '../answerers';
import { containsPhrase, inferPlaybook, playbookForCallTypeClass } from '../ics-playbooks';

const context = (overrides: Partial<IncidentAnswerContext> = {}): IncidentAnswerContext => ({
  board: null,
  adHocUnits: [],
  adHocPersonnel: [],
  timeline: [],
  resolveUserName: (id) => id,
  resolveUnitName: (id) => id,
  ...overrides,
});

describe('ics playbooks', () => {
  it('keeps the keyword match', () => {
    expect(inferPlaybook(['Structure Fire', 'Smoke showing']).type).toBe('StructureFire');
    expect(inferPlaybook(['Vehicle Fire']).type).toBe('VehicleAccident');
    expect(inferPlaybook(['Public assist']).type).toBe('General');
  });

  it('matches keywords as whole phrases, like Core', () => {
    // "od" (overdose) used to match inside "code", "wood" and "food", turning unrelated calls into EMS.
    expect(containsPhrase('code 3 assignment', 'od')).toBe(false);
    expect(containsPhrase('possible od, unresponsive', 'od')).toBe(true);
    expect(containsPhrase('toothbrush on fire', 'brush')).toBe(false);
    expect(inferPlaybook(['Code 3 Assignment']).type).toBe('General');
    expect(inferPlaybook(['Possible OD']).type).toBe('Ems');
  });

  it.each([
    [CallTypeClasses.Fire, 'StructureFire'],
    [CallTypeClasses.Medical, 'Ems'],
    [CallTypeClasses.Rescue, 'TechnicalRescue'],
    [CallTypeClasses.TrafficCollision, 'VehicleAccident'],
    [CallTypeClasses.HazardousMaterials, 'HazMat'],
    [CallTypeClasses.DisasterWeather, 'NaturalDisaster'],
    [CallTypeClasses.Alarm, 'General'],
    [CallTypeClasses.LawEnforcement, 'General'],
    [CallTypeClasses.None, 'General'],
  ])('falls back to the call type class %s when no keyword matches', (callTypeClass, expected) => {
    // A department's own type name ("Code 3 Assignment", "Incendie") says nothing to the keywords; its class does.
    expect(inferPlaybook(['Code 3 Assignment'], callTypeClass).type).toBe(expected);
  });

  it('never lets the coarse class override a keyword', () => {
    expect(inferPlaybook(['Brush Fire'], CallTypeClasses.Fire).type).toBe('Wildland');
    expect(inferPlaybook(['MCI'], CallTypeClasses.Medical).type).toBe('MassCasualty');
  });

  it('uses the class when there is no call text, and ignores a missing class', () => {
    expect(inferPlaybook([], CallTypeClasses.Medical).type).toBe('Ems');
    expect(inferPlaybook(['Code 3 Assignment'], null).type).toBe('General');
    expect(inferPlaybook(['Code 3 Assignment']).type).toBe('General');
    expect(playbookForCallTypeClass(undefined)).toBeNull();
  });

  it('reads the class from the answer context', () => {
    expect(playbookFor(context({ callType: 'Incendie', callTypeClass: CallTypeClasses.Fire })).type).toBe('StructureFire');
    expect(playbookFor(context({ callType: 'Incendie' })).type).toBe('General');
    expect(playbookFor(context({ callType: 'Incendie', callTypeClass: CallTypeClasses.Fire }), 'mci').type).toBe('MassCasualty');
  });
});
