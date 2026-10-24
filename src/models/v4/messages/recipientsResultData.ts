export class RecipientsResultData {
  public Id: string = '';
  public Type: string = '';
  public Name: string = '';
  public Selected: boolean = false;
  /** Absolute URL of the department's uploaded icon for this unit's type (Type "Unit" rows only) (128x128 transparent PNG, anonymous GET). Null when none; undefined from older servers. */
  public TypeIconUrl?: string | null = null;
  /** Built-in map icon name the unit's type picked (lowercase, a MAP_ICONS key). Null when none; undefined from older servers. */
  public TypeMapIcon?: string | null = null;
}
