import { Info } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MapLegendButtonProps {
  onPress: () => void;
  /** Distance from the bottom safe-area edge, so the button can stack with the map's other round controls. */
  bottomOffset?: number;
  testID?: string;
}

/**
 * Round floating map control that opens the map legend; the same look as the main map's layers / recenter buttons.
 */
export const MapLegendButton: React.FC<MapLegendButtonProps> = ({ onPress, bottomOffset = 20, testID = 'map-legend-button' }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('maps.legend.title')}
      onPress={onPress}
      style={[styles.button, { bottom: bottomOffset + insets.bottom, shadowColor: isDark ? '#ffffff' : '#000000', shadowOpacity: isDark ? 0.1 : 0.25 }]}
      testID={testID}
    >
      <Info size={20} color="#ffffff" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 3.84,
  },
});

export default MapLegendButton;
