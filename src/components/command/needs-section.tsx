import { CheckCircle2, CloudOff, Plus, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getNeedCategoryName, getNeedStatusBadgeAction, getNeedStatusName, NEED_CATEGORIES } from '@/lib/incident-command-utils';
import { type IncidentNeed, IncidentNeedCategory, IncidentNeedStatus } from '@/models/v4/incidentCommand/incidentCommandModels';

interface NeedsSectionProps {
  needs: IncidentNeed[];
  onAdd: (name: string, category: number, options?: { description?: string; quantityRequested?: number; priority?: number }) => void;
  onSetStatus: (incidentNeedId: string, status: IncidentNeedStatus, quantityFulfilled?: number) => void;
}

/** Command-level needs (resources/logistics/etc.) tracked to fulfillment. */
export const NeedsSection: React.FC<NeedsSectionProps> = ({ needs, onAdd, onSetStatus }) => {
  const { t } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IncidentNeedCategory>(IncidentNeedCategory.Resource);
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');

  const visible = needs.filter((n) => n.Status !== IncidentNeedStatus.Cancelled).sort((a, b) => a.SortOrder - b.SortOrder);
  const metCount = visible.filter((n) => n.Status === IncidentNeedStatus.Met).length;

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    const parsedQuantity = parseInt(quantity, 10);
    onAdd(name.trim(), category, {
      description: description.trim() || undefined,
      quantityRequested: !Number.isNaN(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : undefined,
    });
    setName('');
    setCategory(IncidentNeedCategory.Resource);
    setQuantity('');
    setDescription('');
    setIsSheetOpen(false);
  }, [name, category, quantity, description, onAdd]);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-needs-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.needs_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            ({metCount}/{visible.length})
          </Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={() => setIsSheetOpen(true)} testID="command-needs-add">
          <ButtonIcon as={Plus} />
          <ButtonText>{t('command.add')}</ButtonText>
        </Button>
      </HStack>

      {visible.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_needs')}</Text>
      ) : (
        <VStack space="sm">
          {visible.map((need) => {
            const isMet = need.Status === IncidentNeedStatus.Met;
            return (
              <HStack key={need.IncidentNeedId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`need-${need.IncidentNeedId}`}>
                <VStack className="flex-1 pr-2">
                  <HStack space="sm" className="items-center">
                    <Text className={`text-base ${isMet ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{need.Name}</Text>
                    {need.IncidentNeedId.startsWith('local-') ? <Icon as={CloudOff} size="sm" className="text-amber-500" /> : null}
                  </HStack>
                  <Text className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    {getNeedCategoryName(t, need.Category)}
                    {need.QuantityRequested > 0 ? ` • ${need.QuantityFulfilled}/${need.QuantityRequested}` : ''}
                  </Text>
                  {need.Description ? <Text className="text-sm text-gray-600 dark:text-gray-300">{need.Description}</Text> : null}
                </VStack>
                <HStack space="sm" className="items-center">
                  <Badge action={getNeedStatusBadgeAction(need.Status)} variant="solid" size="sm">
                    <BadgeText className="text-white">{getNeedStatusName(t, need.Status)}</BadgeText>
                  </Badge>
                  {isMet ? (
                    <Pressable onPress={() => onSetStatus(need.IncidentNeedId, IncidentNeedStatus.Open)} className="p-2" testID={`need-reopen-${need.IncidentNeedId}`}>
                      <Icon as={RotateCcw} size="sm" className="text-gray-400" />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => onSetStatus(need.IncidentNeedId, IncidentNeedStatus.Met)} className="p-2" testID={`need-met-${need.IncidentNeedId}`}>
                      <Icon as={CheckCircle2} size="sm" className="text-green-500" />
                    </Pressable>
                  )}
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      )}

      <CustomBottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} snapPoints={[65]}>
        <VStack space="md" className="w-full">
          <Heading size="md">{t('command.add_need')}</Heading>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_category_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              {NEED_CATEGORIES.map((option) => (
                <Button key={option} size="xs" variant={category === option ? 'solid' : 'outline'} className="mb-1" onPress={() => setCategory(option)} testID={`need-category-${option}`}>
                  <ButtonText>{getNeedCategoryName(t, option)}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_name_label')}</Text>
            <Input size="md" variant="outline">
              <InputField placeholder={t('command.need_name_placeholder')} value={name} onChangeText={setName} testID="need-name-input" />
            </Input>
          </VStack>

          <HStack space="sm">
            <VStack space="xs" className="flex-1">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_quantity_label')}</Text>
              <Input size="md" variant="outline">
                <InputField keyboardType="number-pad" placeholder={t('command.limit_none')} value={quantity} onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))} testID="need-quantity-input" />
              </Input>
            </VStack>
            <VStack space="xs" className="flex-[2]">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_description_label')}</Text>
              <Input size="md" variant="outline">
                <InputField placeholder={t('command.need_description_placeholder')} value={description} onChangeText={setDescription} testID="need-description-input" />
              </Input>
            </VStack>
          </HStack>

          <Button size="lg" onPress={handleSave} isDisabled={!name.trim()} testID="need-save">
            <ButtonText>{t('command.add')}</ButtonText>
          </Button>
        </VStack>
      </CustomBottomSheet>
    </Box>
  );
};
