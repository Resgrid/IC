export class RoleResultData {
  public RoleId: string = '';
  public Name: string = '';
  /** Absolute URL of the role's uploaded icon (128x128 transparent PNG, anonymous GET). Null when none; undefined from older servers. */
  public IconUrl?: string | null = null;
  /** The department's role order (ascending); a person's map pin uses the first role in this order that has an icon. Undefined from older servers. */
  public SortOrder?: number;
}
