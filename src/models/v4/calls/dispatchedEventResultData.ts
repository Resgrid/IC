export class DispatchedEventResultData {
  public Id: string = '';
  public Timestamp: string = '';
  public Type: string = '';
  public Name: string = '';
  public GroupId: string = '';
  public Group: string = '';
  public Note: string = '';
  public StatusId: number = 0;
  public Location: string = '';

  public StatusText: string = '';
  public StatusColor: string = '';
  /** Absolute URL of the department's uploaded icon for this unit's type (unit rows only) (128x128 transparent PNG, anonymous GET). Null when none; undefined from older servers. */
  public TypeIconUrl?: string | null = null;
  /** Built-in map icon name the unit's type picked (lowercase, a MAP_ICONS key). Null when none; undefined from older servers. */
  public TypeMapIcon?: string | null = null;
}
