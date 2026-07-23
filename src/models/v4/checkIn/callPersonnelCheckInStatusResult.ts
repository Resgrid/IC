import { BaseV4Request } from '../baseV4Request';
import { type CallPersonnelCheckInStatusResultData } from './callPersonnelCheckInStatusResultData';

export class CallPersonnelCheckInStatusResult extends BaseV4Request {
  public CallId: number = 0;
  public HasActivePersonnelTimer: boolean = false;
  public DurationMinutes: number = 0;
  public WarningThresholdMinutes: number = 0;
  public Data: CallPersonnelCheckInStatusResultData[] = [];
}
