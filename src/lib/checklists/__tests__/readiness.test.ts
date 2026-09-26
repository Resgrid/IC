import { type ReadinessPacket, summarizeReadiness } from '@/lib/checklists/readiness';

const packet = (): ReadinessPacket => ({
  CallId: 9,
  CoverageStartUtc: '2026-08-23T00:00:00Z',
  CoverageEndUtc: '2026-09-22T00:00:00Z',
  Units: [
    { UnitId: 41, Name: 'Engine 41', DispatchedUtc: '2026-09-22T01:00:00Z' },
    { UnitId: 42, Name: 'Engine 42', DispatchedUtc: '2026-09-22T01:00:00Z' },
    { UnitId: 43, Name: null, DispatchedUtc: '2026-09-22T01:00:00Z' },
  ],
  Checklists: [
    { Name: 'Daily check', Target: { Type: 1, Id: '41' }, StartUtc: '2026-09-20T06:00:00Z', SubmittedUtc: '2026-09-20T07:00:00Z', Completed: true, Missed: false, Skipped: false, Passed: true },
    { Name: 'Daily check', Target: { Type: 1, Id: '41' }, StartUtc: '2026-09-21T06:00:00Z', SubmittedUtc: '2026-09-21T07:00:00Z', Completed: true, Missed: false, Skipped: false, Passed: false },
    { Name: 'Daily check', Target: { Type: 1, Id: '42' }, StartUtc: '2026-09-21T06:00:00Z', SubmittedUtc: '2026-09-21T07:10:00Z', Completed: true, Missed: false, Skipped: false, Passed: true },
    { Name: 'Weekly', Target: { Type: 1, Id: '42' }, StartUtc: '2026-09-15T06:00:00Z', Completed: false, Missed: true, Skipped: false },
    { Name: 'Personal gear', Target: { Type: 3, Id: '41' }, StartUtc: '2026-09-21T06:00:00Z', SubmittedUtc: '2026-09-21T09:00:00Z', Completed: true, Missed: false, Skipped: false, Passed: false },
  ],
  WorkOrders: [
    { WorkOrderId: 'wo-1', Title: 'Pump seal', Status: 3, Priority: 2, UnitId: 43 },
    { WorkOrderId: 'wo-2', Title: 'Done', Status: 6, Priority: 3, UnitId: 43 },
  ],
  UnavailableSources: [],
});

it('flags a failed latest check, a missed check and an open high-priority work order, and keeps other targets out', () => {
  const units = summarizeReadiness(packet(), 'Unit');
  const byId = Object.fromEntries(units.map((unit) => [unit.unitId, unit]));
  expect(byId[41]).toMatchObject({ failed: 1, missed: 0, attention: true });
  expect(byId[41].latest?.SubmittedUtc).toBe('2026-09-21T07:00:00Z');
  expect(byId[42]).toMatchObject({ failed: 0, missed: 1, attention: true });
  expect(byId[43]).toMatchObject({ name: 'Unit', latest: null, attention: true });
  expect(byId[43].openWorkOrders.map((order) => order.WorkOrderId)).toEqual(['wo-1']);
});

it('puts units needing attention first and a clean unit last', () => {
  const clean = packet();
  clean.Checklists = clean.Checklists.filter((entry) => entry.Target?.Id !== '42' || entry.Completed);
  clean.WorkOrders = [];
  const units = summarizeReadiness(clean, 'Unit');
  expect(units.map((unit) => unit.unitId)).toEqual([41, 42, 43]);
  expect(units.find((unit) => unit.unitId === 42)?.attention).toBe(false);
  expect(units[units.length - 1].attention).toBe(false);
});
