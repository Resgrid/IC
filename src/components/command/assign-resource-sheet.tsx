import { Check } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandModels';

export interface AssignableResourceOption {
  kind: ResourceAssignmentKind;
  id: string;
  name: string;
  /** Roster detail line: unit type/group or person group/status. */
  detail?: string;
  /** Small chips: department roles for personnel. */
  chips?: string[];
  /** Live status text (units), rendered as a badge. */
  statusLabel?: string;
  /** Lane the resource currently sits in: undefined = untracked, '' = unassigned pool, else node id. */
  assignedNodeId?: string | null;
}

interface AssignResourceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Department units, personnel, and ad-hoc resources that can be assigned to the lane. */
  options: AssignableResourceOption[];
  /** The lane being assigned to — options already in it are not selectable. */
  targetNodeId: string | null;
  /** Resolves a node id to its display name (used for the "already in lane X" badge). */
  resolveLaneName: (nodeId?: string | null) => string;
  onSave: (kind: ResourceAssignmentKind, resourceId: string) => void;
}

const KIND_TABS: { labelKey: string; kinds: ResourceAssignmentKind[] }[] = [
  { labelKey: 'command.resource_kind_units', kinds: [ResourceAssignmentKind.RealUnit, ResourceAssignmentKind.LinkedDeptUnit] },
  { labelKey: 'command.resource_kind_personnel', kinds: [ResourceAssignmentKind.RealPersonnel, ResourceAssignmentKind.LinkedDeptPersonnel] },
  { labelKey: 'command.resource_kind_external', kinds: [ResourceAssignmentKind.AdHocUnit, ResourceAssignmentKind.AdHocPersonnel] },
];

// eslint-disable-next-line max-lines-per-function
export const AssignResourceSheet: React.FC<AssignResourceSheetProps> = ({ isOpen, onClose, options, targetNodeId, resolveLaneName, onSave }) => {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AssignableResourceOption | null>(null);

  const visibleOptions = useMemo(() => {
    const kinds = KIND_TABS[tabIndex].kinds;
    const normalized = search.trim().toLowerCase();
    const list = options.filter((o) => kinds.includes(o.kind));
    return (normalized ? list.filter((o) => `${o.name} ${o.detail ?? ''}`.toLowerCase().includes(normalized)) : list).slice(0, 30);
  }, [options, tabIndex, search]);

  const handleSave = useCallback(() => {
    if (!selected) {
      return;
    }
    onSave(selected.kind, selected.id);
    setSelected(null);
    setSearch('');
    onClose();
  }, [selected, onSave, onClose]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.assign_resource')}</Heading>

        <HStack space="sm">
          {KIND_TABS.map((tab, index) => (
            <Button key={tab.labelKey} size="xs" variant={tabIndex === index ? 'solid' : 'outline'} onPress={() => setTabIndex(index)} testID={`resource-kind-tab-${index}`}>
              <ButtonText>{t(tab.labelKey)}</ButtonText>
            </Button>
          ))}
        </HStack>

        <Input size="md" variant="outline">
          <InputField placeholder={t('command.search_resources')} value={search} onChangeText={setSearch} testID="resource-search" />
        </Input>

        <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
          <VStack space="xs">
            {visibleOptions.map((option) => {
              const isSelected = selected?.id === option.id && selected?.kind === option.kind;
              const inTargetLane = option.assignedNodeId != null && option.assignedNodeId !== '' && option.assignedNodeId === targetNodeId;
              const inOtherLane = option.assignedNodeId != null && option.assignedNodeId !== '' && option.assignedNodeId !== targetNodeId;
              const inPool = option.assignedNodeId === '';
              return (
                <Pressable
                  key={`${option.kind}-${option.id}`}
                  disabled={inTargetLane}
                  testID={`resource-option-${option.kind}-${option.id}`}
                  className={`rounded-lg px-3 py-2 ${isSelected ? 'bg-primary-500' : inTargetLane ? 'bg-gray-50 opacity-60 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800'}`}
                  onPress={() => setSelected(option)}
                >
                  <HStack className="items-center justify-between" space="sm">
                    <VStack className="min-w-0 flex-1">
                      <Text className={isSelected ? 'font-medium text-white' : 'font-medium text-gray-900 dark:text-white'}>{option.name}</Text>
                      {option.detail ? <Text className={`text-xs ${isSelected ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'}`}>{option.detail}</Text> : null}
                    </VStack>
                    {option.statusLabel ? (
                      <Badge action="muted" variant="outline">
                        <BadgeText>{option.statusLabel}</BadgeText>
                      </Badge>
                    ) : null}
                    {inTargetLane ? (
                      <HStack className="items-center" space="xs" testID={`resource-option-in-lane-${option.kind}-${option.id}`}>
                        <Icon as={Check} size="sm" className="text-success-600" />
                        <Text className="text-xs text-gray-500 dark:text-gray-400">{t('command.in_this_lane')}</Text>
                      </HStack>
                    ) : inOtherLane ? (
                      <Badge action="warning" variant="outline" testID={`resource-option-other-lane-${option.kind}-${option.id}`}>
                        <BadgeText>{resolveLaneName(option.assignedNodeId)}</BadgeText>
                      </Badge>
                    ) : inPool ? (
                      <Badge action="muted" variant="outline">
                        <BadgeText>{t('command.unassigned')}</BadgeText>
                      </Badge>
                    ) : null}
                  </HStack>
                  {option.chips && option.chips.length > 0 ? (
                    <HStack className="mt-1 flex-wrap" space="xs">
                      {option.chips.map((chip) => (
                        <Badge key={chip} action="info" variant="outline">
                          <BadgeText>{chip}</BadgeText>
                        </Badge>
                      ))}
                    </HStack>
                  ) : null}
                </Pressable>
              );
            })}
            {visibleOptions.length === 0 ? <Text className="py-2 text-center text-sm text-gray-500">{t('command.no_resources_found')}</Text> : null}
          </VStack>
        </ScrollView>

        <Button size="lg" onPress={handleSave} isDisabled={!selected} testID="resource-assign-save">
          <ButtonText>{t('command.assign')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
