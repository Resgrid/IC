/**
 * A status style (unit / personnel colours) or priority style (call colours) of the map legend.
 * `Key` is the style key map markers carry in `IconStyle`; the names are the department's own.
 */
export class MapLegendStyleData {
  /** available | dispatched | responding | onscene | transporting | returning | staging | delayed | unavailable | low | medium | high | emergency | unknown */
  public Key: string = '';
  /** "#RRGGBB" */
  public Color: string = '';
  /** ActionBaseTypes the status style groups; not shown. */
  public Meanings?: number[] = [];
  /** Status styles: the department's unit status names (every status set) that show in this style. */
  public UnitStatuses?: string[] = [];
  /** Status styles: the department's personnel status names that show in this style. */
  public PersonnelStatuses?: string[] = [];
  /** Priority styles: the department's priority names that show in this style. */
  public Priorities?: string[] = [];
  /** Status styles: the default unit pin in this style (absolute URL, 32 x 37). */
  public UnitPinIconUrl?: string | null = null;
  /** Status styles: the default person pin in this style. */
  public PersonPinIconUrl?: string | null = null;
  /** Priority styles: the default call pin in this style. */
  public CallPinIconUrl?: string | null = null;
}

/** One priority (calls) or status (units, personnel) of a legend row, with the icon a marker of the row shows in it. */
export class MapLegendStateData {
  /** The stored priority id / status id. */
  public Id: number = 0;
  /** The department's own name for the priority / status. */
  public Name: string = '';
  /** The priority's / status's own hex colour, or null. */
  public Color?: string | null = null;
  /** Style key ("unknown" when the priority / status has no meaning). */
  public IconStyle?: string | null = null;
  /** Upload for this exact state, or the type's own upload with a badge; null = none. */
  public IconUrl?: string | null = null;
  /** Styled built-in pin (absolute URL): the fallback when `IconUrl` is null or fails. */
  public PinIconUrl?: string | null = null;
  /** Bundled fallback icon name. */
  public ImagePath?: string | null = null;
  /** True when `IconUrl` was uploaded for this exact state. */
  public IsVariant?: boolean = false;
}

/** A call type, unit type or role, or the "none" row (`Id` null), with its icon in each priority / status. */
export class MapLegendRowData {
  /** Null for the "none" row: show the app's own localized label, not `Name`. */
  public Id: number | null = null;
  /** The department's name for the call type / unit type / role. */
  public Name: string = '';
  /** Units: the type's custom status set name; null = the built-in unit statuses. */
  public StatusSetName?: string | null = null;
  /** The type's / role's own uploaded icon (no status), or null. */
  public IconUrl?: string | null = null;
  /** Always null for rows; present so a row reads like a marker. */
  public PinIconUrl?: string | null = null;
  /** The bundled icon the type picked, or the default call / unit / person icon. */
  public ImagePath?: string | null = null;
  public States?: MapLegendStateData[] = [];
}

/** A department POI type and the icon its markers show (same fields as PoiLayerData / POI markers). */
export class MapLegendPoiTypeData {
  public PoiTypeId: number = 0;
  public Name: string = '';
  public Color?: string | null = null;
  public PoiImage?: string | null = null;
  public ImagePath?: string | null = null;
  public Marker?: string | null = null;
  public IconUrl?: string | null = null;
}

/** `GET /api/v4/Mapping/GetMapIconLegend` payload. Every list may be missing from older / partial responses. */
export class GetMapIconLegendResultData {
  /** 9 status styles in legend order, then "unknown". */
  public StatusStyles?: MapLegendStyleData[] = [];
  /** low, medium, high, emergency, then "unknown". */
  public PriorityStyles?: MapLegendStyleData[] = [];
  /** First row (Id null) = calls with no type, then call types by name. */
  public Calls?: MapLegendRowData[] = [];
  /** First row (Id null) = units with no type, then unit types by name. */
  public Units?: MapLegendRowData[] = [];
  /** First row (Id null) = members with no role icon, then roles with an uploaded icon, in role order. */
  public Personnel?: MapLegendRowData[] = [];
  /** Department POI types by name. */
  public PoiTypes?: MapLegendPoiTypeData[] = [];
}
