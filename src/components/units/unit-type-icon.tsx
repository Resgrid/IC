import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';

import { MAP_ICONS } from '@/constants/map-icons';

type MapIconKey = keyof typeof MAP_ICONS;

/** The type-icon fields the v4 unit payloads carry (all optional: older servers omit them). */
export interface UnitTypeIconSource {
  iconUrl?: string | null;
  mapIcon?: string | null;
}

export interface UnitTypeIconProps extends UnitTypeIconSource {
  /** Square box edge in px; both the uploaded icon and the bundled pin are fitted (contain) inside it. */
  size?: number;
  /** Rendered when the type has no usable icon (no upload or the upload failed to load, and no known built-in). */
  fallback?: React.ReactNode;
  testID?: string;
}

/** Bundled asset for a built-in map icon name (any case), or null when the name is empty or unknown. */
export const getUnitTypeMapIconAsset = (mapIcon?: string | null) => {
  const key = mapIcon?.trim().toLowerCase();
  return key && Object.prototype.hasOwnProperty.call(MAP_ICONS, key) ? MAP_ICONS[key as MapIconKey].uri : null;
};

/**
 * Icon a department picked for a unit, call or POI type: its uploaded image when there is one, else the
 * built-in map icon it chose, else `fallback`. Purely decorative — the name next to it carries the meaning.
 */
export const UnitTypeIcon: React.FC<UnitTypeIconProps> = ({ iconUrl, mapIcon, size = 24, fallback = null, testID }) => {
  // Remember which URL failed rather than a bare flag, so a unit whose icon changes gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const remoteUrl = iconUrl?.trim() || null;
  const showRemote = !!remoteUrl && remoteUrl !== failedUrl;
  const bundled = getUnitTypeMapIconAsset(mapIcon);
  const handleRemoteError = useCallback(() => setFailedUrl(remoteUrl), [remoteUrl]);

  const source = showRemote && remoteUrl ? { uri: remoteUrl } : bundled;
  if (!source) {
    return <>{fallback}</>;
  }

  return (
    <Image
      accessible={false}
      aria-hidden={true}
      cachePolicy="memory-disk"
      contentFit="contain"
      importantForAccessibility="no-hide-descendants"
      onError={showRemote ? handleRemoteError : undefined}
      source={source}
      style={{ width: size, height: size }}
      testID={testID}
    />
  );
};

/** Same component under a type-neutral name, for call types, POI types and personnel role icons. */
export const TypeIcon = UnitTypeIcon;

export default UnitTypeIcon;
