export class UnitStatusResultData {
  public UnitId: string = '';
  public Name: string = '';
  public Type: string = '';
  public State: string = '';
  public StateCss: string = '';
  public StateStyle: string = '';
  public Timestamp: string = '';
  public TimestampUtc?: string = '';
  public DestinationId?: number | string | null = null;
  public DestinationType?: number | string | null = null;
  public DestinationName?: string = '';
  public DestinationAddress?: string = '';
  public DestinationTypeName?: string = '';
  public Note: string = '';
  public Latitude: number | string | null = null;
  public Longitude: number | string | null = null;
  public GroupName: string = '';
  public GroupId: number | string = '';
  public Eta: string = '';
  /** Absolute URL of the department's uploaded icon for this unit's type (128x128 transparent PNG, anonymous GET). Null when none; undefined from older servers. */
  public TypeIconUrl?: string | null = null;
  /** Built-in map icon name the unit's type picked (lowercase, a MAP_ICONS key). Null when none; undefined from older servers. */
  public TypeMapIcon?: string | null = null;
}
