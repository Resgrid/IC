export class CallTypeResultData {
  public Id: string = '';
  public Name: string = '';
  /** What kind of call the type is (CallTypeClasses, see lib/base-types); -1 when not set, undefined from older servers. */
  public BaseType?: number | null;
  /** Absolute URL of the type's uploaded icon (128x128 transparent PNG, anonymous GET). Null when none; undefined from older servers. */
  public IconUrl?: string | null = null;
  /** Built-in map icon name the type picked (lowercase, a MAP_ICONS key). Null when none; undefined from older servers. */
  public MapIcon?: string | null = null;
}
