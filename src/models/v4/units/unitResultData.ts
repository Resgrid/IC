export class UnitResultData {
  public UnitId: string = '';
  public DepartmentId: string = '';
  public Name: string = '';
  public Type: string = '';
  public TypeId: number = 0;
  public CustomStatusSetId: string = '';
  public GroupId: string = '';
  public GroupName: string = '';
  public Vin: string = '';
  public PlateNumber: string = '';
  public FourWheelDrive: boolean = false;
  public SpecialPermit: boolean = false;
  public CurrentDestinationId: string = '';
  public CurrentStatusId: string = '';
  public CurrentStatusTimestamp: string = '';
  public Latitude: string = '';
  public Longitude: string = '';
  public Note: string = '';
  /** Absolute URL of the department's uploaded icon for this unit's type (128x128 transparent PNG, anonymous GET). Null when none; undefined from older servers. */
  public TypeIconUrl?: string | null = null;
  /** Built-in map icon name the unit's type picked (lowercase, a MAP_ICONS key). Null when none; undefined from older servers. */
  public TypeMapIcon?: string | null = null;
}
