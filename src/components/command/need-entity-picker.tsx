import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { NeedEntityKind } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useDispatchStore } from '@/stores/dispatch/store';

export interface SelectedNeedEntity {
  kind: NeedEntityKind;
  id: string;
  name: string;
}

const TABS: { kind: NeedEntityKind; labelKey: string }[] = [
  { kind: NeedEntityKind.Unit, labelKey: 'command.need_entity_tab_units' },
  { kind: NeedEntityKind.User, labelKey: 'command.need_entity_tab_users' },
  { kind: NeedEntityKind.Role, labelKey: 'command.need_entity_tab_roles' },
  { kind: NeedEntityKind.Group, labelKey: 'command.need_entity_tab_groups' },
];

interface NeedEntityPickerProps {
  selected: SelectedNeedEntity[];
  onChange: (selected: SelectedNeedEntity[]) => void;
}

/** Multi-select picker for Entity needs: any combination of units, users, roles, and groups. */
export const NeedEntityPicker: React.FC<NeedEntityPickerProps> = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const dispatchData = useDispatchStore((state) => state.data);
  const fetchDispatchData = useDispatchStore((state) => state.fetchDispatchData);
  const [activeTab, setActiveTab] = useState<NeedEntityKind>(NeedEntityKind.Unit);

  useEffect(() => {
    fetchDispatchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const optionsFor = (kind: NeedEntityKind) => {
    switch (kind) {
      case NeedEntityKind.Unit:
        return dispatchData.units;
      case NeedEntityKind.User:
        return dispatchData.users;
      case NeedEntityKind.Role:
        return dispatchData.roles;
      default:
        return dispatchData.groups;
    }
  };

  const isSelected = (kind: NeedEntityKind, id: string) => selected.some((entity) => entity.kind === kind && entity.id === id);

  const toggle = (kind: NeedEntityKind, id: string, name: string) => {
    if (isSelected(kind, id)) {
      onChange(selected.filter((entity) => !(entity.kind === kind && entity.id === id)));
    } else {
      onChange([...selected, { kind, id, name }]);
    }
  };

  return (
    <VStack space="xs" testID="need-entity-picker">
      <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.need_entities_label')}</Text>

      <HStack space="sm">
        {TABS.map((tab) => (
          <Button key={tab.kind} size="xs" variant={activeTab === tab.kind ? 'solid' : 'outline'} onPress={() => setActiveTab(tab.kind)} testID={`need-entity-tab-${tab.kind}`}>
            <ButtonText>{t(tab.labelKey)}</ButtonText>
          </Button>
        ))}
      </HStack>

      <HStack className="flex-wrap" space="sm">
        {optionsFor(activeTab).map((option) => (
          <Button
            key={`${activeTab}-${option.Id}`}
            size="xs"
            variant={isSelected(activeTab, option.Id) ? 'solid' : 'outline'}
            className="mb-1"
            onPress={() => toggle(activeTab, option.Id, option.Name)}
            testID={`need-entity-option-${activeTab}-${option.Id}`}
          >
            <ButtonText>{option.Name}</ButtonText>
          </Button>
        ))}
      </HStack>

      <Text className="text-xs text-gray-500 dark:text-gray-400" testID="need-entity-selected-count">
        {t('command.need_entities_selected', { count: selected.length })}
      </Text>
    </VStack>
  );
};
