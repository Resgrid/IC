import { router } from 'expo-router';
import { Building2, Search } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useMapsStore } from '@/stores/maps/store';

interface MapLayersSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * On-map control: toggle department GeoJSON layers and jump to the
 * custom/indoor maps browser and unified map search.
 */
export const MapLayersSheet: React.FC<MapLayersSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const activeLayers = useMapsStore((state) => state.activeLayers);
  const layerToggles = useMapsStore((state) => state.layerToggles);
  const toggleLayer = useMapsStore((state) => state.toggleLayer);

  const navigate = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[70]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('maps.map_layers')}</Heading>

        {activeLayers.length === 0 ? (
          <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('maps.no_layers')}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            <VStack space="sm">
              {activeLayers.map((layer) => (
                <HStack key={layer.Id} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800" testID={`layer-row-${layer.Id}`}>
                  <HStack space="sm" className="flex-1 items-center">
                    {layer.Color ? <Box className="size-3 rounded-full" style={{ backgroundColor: layer.Color }} /> : null}
                    <Text className="flex-1 text-base text-gray-900 dark:text-white">{layer.Name}</Text>
                  </HStack>
                  <Switch value={!!layerToggles[layer.Id]} onValueChange={() => toggleLayer(layer.Id)} testID={`layer-toggle-${layer.Id}`} />
                </HStack>
              ))}
            </VStack>
          </ScrollView>
        )}

        <VStack space="sm">
          <Button variant="outline" onPress={() => navigate('/maps')} testID="browse-maps-button">
            <ButtonIcon as={Building2} />
            <ButtonText>{t('maps.title')}</ButtonText>
          </Button>
          <Button variant="outline" onPress={() => navigate('/maps/search')} testID="search-maps-button">
            <ButtonIcon as={Search} />
            <ButtonText>{t('maps.search_maps')}</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </CustomBottomSheet>
  );
};
