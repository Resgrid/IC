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
}
