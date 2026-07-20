import { createApiEndpoint } from '../common/client';

/**
 * Command definition templates (CommandsController) — department-defined lane sets
 * per call type. Lets a security company or event operator pre-build boards like
 * "Concert" with Medical Booth / Patrols / Customer Service lanes.
 */

export interface CommandRoleResultData {
  CommandDefinitionRoleId: number;
  Name: string;
  Description?: string | null;
  LaneType: number;
  SortOrder: number;
  MinUnitPersonnel: number;
  MaxUnitPersonnel: number;
  MinUnits: number;
  MaxUnits: number;
  MinTimeInRole: number;
  MaxTimeInRole: number;
  /** Lane identification color (hex); board lanes and marker tints inherit it. */
  Color?: string | null;
  ForceRequirements: boolean;
  RequiredUnitTypes: number[];
  RequiredPersonnelRoles: number[];
}

export interface CommandResultData {
  CommandDefinitionId: number;
  CallTypeId?: number | null;
  Name: string;
  Description?: string | null;
  Timer: boolean;
  TimerMinutes: number;
  Lanes: CommandRoleResultData[];
}

interface V4Result<T> {
  Data: T;
  Status?: string;
  Message?: string;
}

export const getAllCommands = async () => {
  const response = await createApiEndpoint('/Commands/GetAllCommands').get<V4Result<CommandResultData[]>>();
  return response.data;
};

export const getCommand = async (commandDefinitionId: number) => {
  const response = await createApiEndpoint(`/Commands/GetCommand/${commandDefinitionId}`).get<V4Result<CommandResultData>>();
  return response.data;
};

/** Pass callTypeId 0 for the "Any Call Type" default template. */
export const getCommandForCallType = async (callTypeId: number) => {
  const response = await createApiEndpoint(`/Commands/GetCommandForCallType/${callTypeId}`).get<V4Result<CommandResultData>>();
  return response.data;
};
