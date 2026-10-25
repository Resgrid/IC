import { Image as ExpoImage } from 'expo-image';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PointAnnotation } from '@/components/maps/mapbox';
import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

interface PinMarkerProps {
  imagePath?: MapIconKey;
  poiImage?: MapIconKey;
  /**
   * Uploaded icon URL — the call/unit type's icon, or for a personnel pin the person's role icon; shown in place of
   * the bundled icon when it loads.
   */
  iconUrl?: string | null;
  /**
   * Built-in pin recoloured to the call's priority or the unit's / person's status (`MapMakerInfoData.PinIconUrl`).
   * Drawn exactly where and how the bundled pin is when there is no (working) uploaded icon; the bundled pin comes
   * back if it fails to load. Only absolute http(s) URLs are used.
   */
  pinIconUrl?: string | null;
  title: string;
  /** Command lane name — shown under the title when the resource is on the active board. */
  laneLabel?: string;
  /** Command lane color — ring around the icon for at-a-glance lane identification. */
  accentColor?: string | null;
  size?: number;
  markerRef?: React.ComponentRef<typeof PointAnnotation> | null;
  onPress?: () => void;
}

/** The status / priority pin URL when it is an absolute http(s) URL, else null (blank, relative or other schemes). */
export const getPinIconUrl = (pinIconUrl?: string | null): string | null => {
  const url = pinIconUrl?.trim();
  return url && /^https?:\/\/\S+$/i.test(url) ? url : null;
};

interface PinMarkerIconProps {
  imagePath?: MapIconKey | string | null;
  poiImage?: MapIconKey | string | null;
  iconUrl?: string | null;
  pinIconUrl?: string | null;
  accentColor?: string | null;
  size?: number;
  /**
   * False: when there is no (working) uploaded icon or status pin, keep the box empty instead of drawing the bundled
   * icon. For a legend swatch that has no bundled counterpart (a status style's default pin); map markers always fall back.
   */
  fallbackToBundled?: boolean;
  /** Screen-reader label for the icon; map markers leave it unset (their title is the label). */
  accessibilityLabel?: string;
  /**
   * Test id base: the image gets `${testID}-upload`, `${testID}-pin`, `${testID}-bundled` or `${testID}-empty`. Without it
   * the upload and status pin keep the marker's `pin-type-icon` / `pin-status-icon`.
   */
  testID?: string;
}

/**
 * The icon of a call / unit / station / person marker, without its title: the uploaded icon (`IconUrl`), else the
 * status / priority pin (`PinIconUrl`), else the bundled `ImagePath` asset, each failed remote image falling back down
 * the chain. The map's markers and the map legend both draw through this, so a legend icon is exactly the marker icon.
 */
export const PinMarkerIcon: React.FC<PinMarkerIconProps> = React.memo(({ imagePath, poiImage, iconUrl, pinIconUrl, accentColor, size = 32, fallbackToBundled = true, accessibilityLabel, testID }) => {
  // Prefer poiImage (new field) over imagePath (null for POIs after backend fix),
  // with final fallback to default 'call' icon
  const resolvedPath = poiImage || imagePath;
  const iconKey = resolvedPath?.toLowerCase() as MapIconKey;
  const icon = iconKey && MAP_ICONS[iconKey] ? MAP_ICONS[iconKey] : MAP_ICONS['call'];
  const ringStyle = accentColor ? { ...styles.accentRing, borderColor: accentColor, borderRadius: size / 2 } : null;
  const a11y = accessibilityLabel ? { accessible: true, accessibilityLabel, accessibilityRole: 'image' as const } : null;

  // Uploaded type / role icon: same square footprint as the bundled pin, and back to the status pin (else the bundled
  // pin) if it fails to load. Remember which URL failed (not a bare flag) so a changed icon gets a fresh attempt.
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const remoteIconUrl = iconUrl?.trim() || null;
  const showUploadedIcon = !!remoteIconUrl && remoteIconUrl !== failedIconUrl;

  // Status / priority pin: the bundled pin's image recoloured server side, so it takes the bundled pin's exact box,
  // fit and lane ring (and no tint). Same failed-URL memory, so the next status's pin is tried afresh.
  const [failedPinIconUrl, setFailedPinIconUrl] = useState<string | null>(null);
  const statusPinUrl = getPinIconUrl(pinIconUrl);
  const showStatusPin = !showUploadedIcon && !!statusPinUrl && statusPinUrl !== failedPinIconUrl;

  if (showUploadedIcon && remoteIconUrl) {
    return (
      <ExpoImage
        cachePolicy="memory-disk"
        contentFit="contain"
        onError={() => setFailedIconUrl(remoteIconUrl)}
        source={{ uri: remoteIconUrl }}
        style={[{ width: size, height: size }, ringStyle]}
        testID={testID ? `${testID}-upload` : 'pin-type-icon'}
        {...a11y}
      />
    );
  }

  if (showStatusPin && statusPinUrl) {
    return (
      <ExpoImage
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => setFailedPinIconUrl(statusPinUrl)}
        source={{ uri: statusPinUrl }}
        style={[styles.image, { width: size, height: size }, ringStyle]}
        testID={testID ? `${testID}-pin` : 'pin-status-icon'}
        {...a11y}
      />
    );
  }

  if (!fallbackToBundled) {
    return <View style={{ width: size, height: size }} testID={testID ? `${testID}-empty` : undefined} {...a11y} />;
  }

  return <Image fadeDuration={0} source={icon.uri} style={[styles.image, { width: size, height: size }, ringStyle]} testID={testID ? `${testID}-bundled` : undefined} {...a11y} />;
});

PinMarkerIcon.displayName = 'PinMarkerIcon';

const PinMarker: React.FC<PinMarkerProps> = React.memo(({ imagePath, poiImage, iconUrl, pinIconUrl, title, laneLabel, accentColor, size = 32, onPress }) => {
  const { colorScheme } = useColorScheme();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <PinMarkerIcon imagePath={imagePath} poiImage={poiImage} iconUrl={iconUrl} pinIconUrl={pinIconUrl} accentColor={accentColor} size={size} />
      <Text style={[styles.title, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]} numberOfLines={2}>
        {title}
      </Text>
      {laneLabel ? (
        <Text style={[styles.laneLabel, accentColor ? { backgroundColor: accentColor } : null]} numberOfLines={1} testID="pin-lane-label">
          {laneLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});

PinMarker.displayName = 'PinMarker';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    overflow: 'visible',
    resizeMode: 'cover',
  },
  title: {
    marginTop: 2,
    overflow: 'visible',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  accentRing: {
    borderWidth: 3,
  },
  laneLabel: {
    marginTop: 1,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#6b7280',
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
});

export default PinMarker;
