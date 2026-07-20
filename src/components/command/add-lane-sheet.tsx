import { Check } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { COMMAND_NODE_TYPES, getCommandNodeTypeName } from '@/lib/incident-command-utils';
import { CommandNodeType } from '@/models/v4/incidentCommand/incidentCommandModels';

/** Lane identification colors — markers of resources in the lane inherit these on the map. */
export const LANE_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#7f8c8d'];

/** Quick-fill lane names spanning ICS, security, and event operations. */
const LANE_NAME_SUGGESTION_KEYS = [
  'lane_suggestion_medical',
  'lane_suggestion_patrol',
  'lane_suggestion_security_post',
  'lane_suggestion_customer_service',
  'lane_suggestion_gate',
  'lane_suggestion_stage',
  'lane_suggestion_parking',
  'lane_suggestion_vendor',
  'lane_suggestion_staging',
  'lane_suggestion_operations',
];

/** Optional per-lane limits: 0/undefined = no limit. */
export interface LaneLimits {
  minUnits?: number;
  maxUnits?: number;
  minUnitPersonnel?: number;
  maxUnitPersonnel?: number;
  minTimeInRole?: number;
  maxTimeInRole?: number;
}

interface AddLaneSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Add a structural lane (Division/Group/Branch/...) to the command board. */
  onSave: (name: string, nodeType: CommandNodeType, color?: string, limits?: LaneLimits) => void;
}

export const AddLaneSheet: React.FC<AddLaneSheetProps> = ({ isOpen, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [nodeType, setNodeType] = useState<CommandNodeType>(CommandNodeType.Division);
  const [color, setColor] = useState<string | undefined>(undefined);
  const [showLimits, setShowLimits] = useState(false);
  const [limits, setLimits] = useState<Record<keyof LaneLimits, string>>({ minUnits: '', maxUnits: '', minUnitPersonnel: '', maxUnitPersonnel: '', minTimeInRole: '', maxTimeInRole: '' });

  const setLimit = useCallback((key: keyof LaneLimits, value: string) => {
    setLimits((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, '') }));
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    const parsedLimits: LaneLimits = {};
    (Object.keys(limits) as (keyof LaneLimits)[]).forEach((key) => {
      const parsed = parseInt(limits[key], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        parsedLimits[key] = parsed;
      }
    });
    onSave(name.trim(), nodeType, color, Object.keys(parsedLimits).length > 0 ? parsedLimits : undefined);
    setName('');
    setNodeType(CommandNodeType.Division);
    setColor(undefined);
    setShowLimits(false);
    setLimits({ minUnits: '', maxUnits: '', minUnitPersonnel: '', maxUnitPersonnel: '', minTimeInRole: '', maxTimeInRole: '' });
    onClose();
  }, [name, nodeType, color, limits, onSave, onClose]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[65]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.add_lane')}</Heading>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.lane_type_label')}</Text>
          <HStack className="flex-wrap" space="sm">
            {COMMAND_NODE_TYPES.map((type) => (
              <Button key={type} size="xs" variant={nodeType === type ? 'solid' : 'outline'} className="mb-1" onPress={() => setNodeType(type)} testID={`lane-type-${type}`}>
                <ButtonText>{getCommandNodeTypeName(t, type)}</ButtonText>
              </Button>
            ))}
          </HStack>
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.lane_name_label')}</Text>
          <HStack className="flex-wrap" space="sm">
            {LANE_NAME_SUGGESTION_KEYS.map((key) => (
              <Button key={key} size="xs" variant="outline" className="mb-1" onPress={() => setName(t(`command.${key}`))} testID={`lane-suggestion-${key}`}>
                <ButtonText>{t(`command.${key}`)}</ButtonText>
              </Button>
            ))}
          </HStack>
          <Input size="md" variant="outline">
            <InputField placeholder={t('command.lane_name_placeholder')} value={name} onChangeText={setName} testID="lane-name-input" />
          </Input>
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.lane_color_label')}</Text>
          <HStack className="flex-wrap items-center" space="sm">
            {LANE_COLORS.map((swatch) => (
              <Pressable
                key={swatch}
                accessibilityLabel={swatch}
                accessibilityRole="button"
                style={[styles.swatch, { backgroundColor: swatch }]}
                className="mb-1 items-center justify-center"
                onPress={() => setColor(color === swatch ? undefined : swatch)}
                testID={`lane-color-${swatch.slice(1)}`}
              >
                {color === swatch ? <Check color="#ffffff" size={16} /> : null}
              </Pressable>
            ))}
          </HStack>
        </VStack>

        <VStack space="xs">
          <Button size="xs" variant="outline" onPress={() => setShowLimits((v) => !v)} testID="lane-limits-toggle">
            <ButtonText>{t('command.lane_limits_label')}</ButtonText>
          </Button>
          {showLimits ? (
            <VStack space="sm" className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900" testID="lane-limits-form">
              <HStack space="sm">
                <VStack className="flex-1" space="xs">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('command.limit_min_units')}</Text>
                  <Input size="sm" variant="outline">
                    <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={limits.minUnits} onChangeText={(v) => setLimit('minUnits', v)} testID="limit-min-units" />
                  </Input>
                </VStack>
                <VStack className="flex-1" space="xs">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('command.limit_max_units')}</Text>
                  <Input size="sm" variant="outline">
                    <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={limits.maxUnits} onChangeText={(v) => setLimit('maxUnits', v)} testID="limit-max-units" />
                  </Input>
                </VStack>
              </HStack>
              <Text className="text-xs text-gray-500 dark:text-gray-400">{t('command.limit_units_help')}</Text>
              <HStack space="sm">
                <VStack className="flex-1" space="xs">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('command.limit_min_riding')}</Text>
                  <Input size="sm" variant="outline">
                    <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={limits.minUnitPersonnel} onChangeText={(v) => setLimit('minUnitPersonnel', v)} testID="limit-min-riding" />
                  </Input>
                </VStack>
                <VStack className="flex-1" space="xs">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('command.limit_max_riding')}</Text>
                  <Input size="sm" variant="outline">
                    <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={limits.maxUnitPersonnel} onChangeText={(v) => setLimit('maxUnitPersonnel', v)} testID="limit-max-riding" />
                  </Input>
                </VStack>
              </HStack>
              <Text className="text-xs text-gray-500 dark:text-gray-400">{t('command.limit_riding_help')}</Text>
              <HStack space="sm">
                <VStack className="flex-1" space="xs">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('command.limit_min_time')}</Text>
                  <Input size="sm" variant="outline">
                    <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={limits.minTimeInRole} onChangeText={(v) => setLimit('minTimeInRole', v)} testID="limit-min-time" />
                  </Input>
                </VStack>
                <VStack className="flex-1" space="xs">
                  <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('command.limit_max_time')}</Text>
                  <Input size="sm" variant="outline">
                    <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={limits.maxTimeInRole} onChangeText={(v) => setLimit('maxTimeInRole', v)} testID="limit-max-time" />
                  </Input>
                </VStack>
              </HStack>
              <Text className="text-xs text-gray-500 dark:text-gray-400">{t('command.limit_time_help')}</Text>
            </VStack>
          ) : null}
        </VStack>

        <Button size="lg" onPress={handleSave} isDisabled={!name.trim()} testID="lane-save">
          <ButtonText>{t('command.add')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};

const styles = StyleSheet.create({
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
