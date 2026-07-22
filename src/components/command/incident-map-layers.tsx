import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { Text } from '@/components/ui/text';
import { IncidentMapAnnotationType } from '@/models/v4/incidentCommand/incidentCommandEnums';
import { type IncidentCommand, type IncidentMapAnnotation } from '@/models/v4/incidentCommand/incidentCommandModels';

const MARKUP_COLOR = '#dc2626';

/** Parses an annotation's stored GeoJson into a Feature (accepts a bare geometry too). */
export const parseAnnotationFeature = (annotation: IncidentMapAnnotation): GeoJSON.Feature | null => {
  try {
    const parsed = JSON.parse(annotation.GeoJson);
    const feature: GeoJSON.Feature = parsed?.type === 'Feature' ? parsed : { type: 'Feature', geometry: parsed, properties: {} };
    if (!feature.geometry) {
      return null;
    }
    feature.properties = { ...(feature.properties ?? {}), annotationId: annotation.IncidentMapAnnotationId, label: annotation.Label ?? null };
    return feature;
  } catch {
    return null;
  }
};

/** First coordinate of a feature (for placing text/marker labels). */
export const annotationPointCoordinate = (feature: GeoJSON.Feature): [number, number] | null => {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (geometry.type === 'Point') return geometry.coordinates as [number, number];
  if (geometry.type === 'LineString') return (geometry.coordinates[0] as [number, number]) ?? null;
  if (geometry.type === 'Polygon') return (geometry.coordinates[0]?.[0] as [number, number]) ?? null;
  return null;
};

interface AnnotationLayersProps {
  annotations: IncidentMapAnnotation[];
  /** Called with the annotation id when a drawn line/area is tapped (edit mode). */
  onAnnotationPress?: (incidentMapAnnotationId: string) => void;
}

/** Renders the incident's drawn markup: lines, areas, and text labels. */
export const AnnotationLayers: React.FC<AnnotationLayersProps> = ({ annotations, onAnnotationPress }) => {
  const { lineCollection, areaCollection, labels } = useMemo(() => {
    const lines: GeoJSON.Feature[] = [];
    const areas: GeoJSON.Feature[] = [];
    const labelFeatures: { id: string; label: string; coordinate: [number, number] }[] = [];

    for (const annotation of annotations) {
      if (annotation.DeletedOn) continue;
      const feature = parseAnnotationFeature(annotation);
      if (!feature) continue;

      if (annotation.AnnotationType === IncidentMapAnnotationType.Polygon) {
        areas.push(feature);
      } else if (annotation.AnnotationType === IncidentMapAnnotationType.Line) {
        lines.push(feature);
      } else {
        const coordinate = annotationPointCoordinate(feature);
        if (coordinate) {
          labelFeatures.push({ id: annotation.IncidentMapAnnotationId, label: annotation.Label ?? '•', coordinate });
        }
        continue;
      }

      // Lines/areas with a label also get a text chip at their first vertex.
      if (annotation.Label) {
        const coordinate = annotationPointCoordinate(feature);
        if (coordinate) {
          labelFeatures.push({ id: `${annotation.IncidentMapAnnotationId}-label`, label: annotation.Label, coordinate });
        }
      }
    }

    return {
      lineCollection: { type: 'FeatureCollection', features: lines } as GeoJSON.FeatureCollection,
      areaCollection: { type: 'FeatureCollection', features: areas } as GeoJSON.FeatureCollection,
      labels: labelFeatures,
    };
  }, [annotations]);

  const handlePress = (event: { features?: GeoJSON.Feature[] }) => {
    const annotationId = (event?.features?.[0]?.properties as { annotationId?: string } | null | undefined)?.annotationId;
    if (annotationId && onAnnotationPress) {
      onAnnotationPress(annotationId);
    }
  };

  return (
    <>
      {areaCollection.features.length > 0 ? (
        <Mapbox.ShapeSource id="incident-annotation-areas" shape={areaCollection} onPress={onAnnotationPress ? handlePress : undefined}>
          <Mapbox.FillLayer id="incident-annotation-areas-fill" style={{ fillColor: MARKUP_COLOR, fillOpacity: 0.15 }} />
          <Mapbox.LineLayer id="incident-annotation-areas-outline" style={{ lineColor: MARKUP_COLOR, lineWidth: 2 }} />
        </Mapbox.ShapeSource>
      ) : null}
      {lineCollection.features.length > 0 ? (
        <Mapbox.ShapeSource id="incident-annotation-lines" shape={lineCollection} onPress={onAnnotationPress ? handlePress : undefined}>
          <Mapbox.LineLayer id="incident-annotation-lines-line" style={{ lineColor: MARKUP_COLOR, lineWidth: 3 }} />
        </Mapbox.ShapeSource>
      ) : null}
      {labels.map((label) => (
        <Mapbox.MarkerView key={label.id} id={`annotation-label-${label.id}`} coordinate={label.coordinate} anchor={{ x: 0.5, y: 1 }} allowOverlap>
          <View style={styles.labelChip} pointerEvents={onAnnotationPress ? 'auto' : 'none'}>
            <Text style={styles.labelText} onPress={onAnnotationPress ? () => onAnnotationPress(label.id.replace(/-label$/, '')) : undefined}>
              {label.label}
            </Text>
          </View>
        </Mapbox.MarkerView>
      ))}
    </>
  );
};

const INCIDENT_LOCATIONS = [
  { key: 'icp', textKey: 'ICP', color: '#2563eb', latField: 'CommandPostLatitude', lonField: 'CommandPostLongitude' },
  { key: 'staging', textKey: 'STG', color: '#d97706', latField: 'StagingLatitude', lonField: 'StagingLongitude' },
  { key: 'rehab', textKey: 'RHB', color: '#16a34a', latField: 'RehabLatitude', lonField: 'RehabLongitude' },
] as const;

interface IncidentLocationMarkersProps {
  command: IncidentCommand;
}

/** Fixed incident-location markers: ICP (Command Post), Staging, and Rehab, from the command's saved coordinates. */
export const IncidentLocationMarkers: React.FC<IncidentLocationMarkersProps> = ({ command }) => {
  return (
    <>
      {INCIDENT_LOCATIONS.map((location) => {
        const latitude = parseFloat((command[location.latField] as string | null | undefined) ?? '');
        const longitude = parseFloat((command[location.lonField] as string | null | undefined) ?? '');
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        return (
          <Mapbox.MarkerView key={location.key} id={`incident-location-${location.key}`} coordinate={[longitude, latitude]} anchor={{ x: 0.5, y: 1 }} allowOverlap>
            <View style={[styles.locationChip, { backgroundColor: location.color }]} pointerEvents="none" testID={`incident-location-${location.key}`}>
              <Text style={styles.locationText}>{location.textKey}</Text>
            </View>
          </Mapbox.MarkerView>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  labelChip: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  locationChip: {
    alignItems: 'center',
    borderColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  locationText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
