import type { Href } from 'expo-router';

// What this app does with a deployment. The server enforces every rule again; this only shapes the UI.
// The incident commander files their own time and reviews and approves the crews working the incident.
export const operationsCapabilities = {
  /** Write crew / individual time reports (the commander's own time and any crew they are seated on). */
  editTime: true,
  /** Record odometer / engine / fuel readings against a deployment unit. */
  recordUsage: false,
  /** Add expenses (meals, fuel, lodging) with a receipt photo. */
  recordExpenses: false,
  /** Approve submitted time reports when the person holds TimeReports_Approve. */
  approveTime: true,
  /** Draft and validate the CAL OES MARS F-42 from the field. */
  draftF42: true,
  homeRoute: '/' as Href,
  useActiveUnitId: (): string | null => null,
};
