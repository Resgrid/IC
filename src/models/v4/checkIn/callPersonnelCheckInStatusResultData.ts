export class CallPersonnelCheckInStatusResultData {
  public UserId: string = '';
  public FullName: string = '';
  public LastCheckIn: string | null = null;
  public NeedsCheckIn: boolean = false;
  public MinutesRemaining: number = 0;
  public Status: string = '';
}
