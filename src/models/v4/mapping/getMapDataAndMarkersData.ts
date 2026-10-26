import { type PoiLayerData } from './poiResultData';

export class MapDataAndMarkersData {
  public CenterLat: number | string = 0;
  public CenterLon: number | string = 0;
  public ZoomLevel: number | string = 0;
  public MapMakerInfos: MapMakerInfoData[] = [];
  public PoiLayers?: PoiLayerData[] = [];
}

export class MapMakerInfoData {
  public Id: string = '';
  public Longitude: number = 0;
  public Latitude: number = 0;
  public Title: string = '';
  public zIndex: number | string = 0;
  public ImagePath: string = '';
  public InfoWindowContent: string = '';
  public Color: string = '';
  public Type: number = 0;
  public Marker?: string = '';
  public PoiImage: string = '';
  public PoiTypeId?: number | null = null;
  public PoiTypeName?: string = '';
  public Address?: string = '';
  public Note?: string = '';
  public LayerId?: string = '';
  public LayerName?: string = '';
  /**
   * Uploaded icon URL — wins over the bundled icon / POI shape when present: the type's icon for call (Type 0), unit
   * (Type 1) and POI (Type 4) pins; for personnel (Type 3) pins the icon of the first role the person holds, in the
   * department's role order, that has one. Null when there is no upload, undefined from older servers.
   */
  public IconUrl?: string | null = null;
  /**
   * Absolute URL of the built-in pin recoloured to the call's priority or the unit's / person's status: a 32 x 37 PNG
   * with the bundled pin's shape, size and tip, drawn in place of the bundled `ImagePath` pin when there is no upload.
   * Null when the priority/status has no meaning and always for stations, POIs and hydrants; undefined from older servers.
   */
  public PinIconUrl?: string | null = null;
  /**
   * Style key behind `PinIconUrl` and the badge on `IconUrl`: a status (`available`, `dispatched`, `responding`, `onscene`,
   * `transporting`, `returning`, `staging`, `delayed`, `unavailable`) or a priority (`low`, `medium`, `high`, `emergency`).
   * Null / undefined as for `PinIconUrl`.
   */
  public IconStyle?: string | null = null;
}
