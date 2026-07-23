import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import Mapbox from '@/components/maps/mapbox';
import { getPolygonBounds, getSeverityColor, parseCenterLocation, parsePolygonGeoJSON } from '@/lib/weather-alert-utils';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';

interface WeatherAlertDetailMapProps {
  alert: WeatherAlertResultData;
}

export const WeatherAlertDetailMap: React.FC<WeatherAlertDetailMapProps> = ({ alert }) => {
  const severityColor = getSeverityColor(alert.Severity);

  const polygonGeoJSON = useMemo(() => parsePolygonGeoJSON(alert.Polygon), [alert.Polygon]);
  const centerLocation = useMemo(() => parseCenterLocation(alert.CenterGeoLocation), [alert.CenterGeoLocation]);

  const bounds = useMemo(() => {
    if (!polygonGeoJSON) return null;
    const polygonBounds = getPolygonBounds(polygonGeoJSON);
    if (!polygonBounds) return null;

    return {
      ...polygonBounds,
      paddingTop: 40,
      paddingBottom: 40,
      paddingLeft: 40,
      paddingRight: 40,
    };
  }, [polygonGeoJSON]);

  const cameraProps = useMemo(() => {
    if (bounds) {
      return { bounds };
    }
    if (centerLocation) {
      return {
        centerCoordinate: [centerLocation.longitude, centerLocation.latitude] as [number, number],
        zoomLevel: 8,
      };
    }
    return null;
  }, [bounds, centerLocation]);

  if (!cameraProps) return null;

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
        <Mapbox.Camera {...cameraProps} animationDuration={0} />

        {polygonGeoJSON && bounds ? (
          <Mapbox.ShapeSource id="alert-polygon" shape={polygonGeoJSON}>
            <Mapbox.FillLayer
              id="alert-polygon-fill"
              style={{
                fillColor: severityColor,
                fillOpacity: 0.2,
              }}
            />
            <Mapbox.LineLayer
              id="alert-polygon-line"
              style={{
                lineColor: severityColor,
                lineWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {!bounds && centerLocation ? (
          <Mapbox.PointAnnotation id="alert-center" coordinate={[centerLocation.longitude, centerLocation.latitude]}>
            <View style={[styles.marker, { backgroundColor: severityColor }]} />
          </Mapbox.PointAnnotation>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
