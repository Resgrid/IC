import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getIncidentRoleName, ICS_ROLE_PRESETS } from '@/lib/incident-command-utils';
import { type IncidentRoleType } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useRolesStore } from '@/stores/roles/store';

interface AddAssignmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Assign a NIMS/ICS position to a department member. */
  onSave: (roleType: IncidentRoleType, userId: string) => void;
}

export const AddAssignmentSheet: React.FC<AddAssignmentSheetProps> = ({ isOpen, onClose, onSave }) => {
  const { t } = useTranslation();
  const users = useRolesStore((state) => state.users);
  const [roleType, setRoleType] = useState<IncidentRoleType | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = normalized ? users.filter((u) => `${u.FirstName} ${u.LastName}`.toLowerCase().includes(normalized)) : users;
    return list.slice(0, 25);
  }, [users, search]);

  const handleSave = useCallback(() => {
    if (roleType === null || !selectedUserId) {
      return;
    }
    onSave(roleType, selectedUserId);
    setRoleType(null);
    setSelectedUserId(null);
    setSearch('');
    onClose();
  }, [roleType, selectedUserId, onSave, onClose]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.add_assignment')}</Heading>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.role_label')}</Text>
          <HStack className="flex-wrap" space="sm">
            {ICS_ROLE_PRESETS.map((preset) => (
              <Button key={preset} size="xs" variant={roleType === preset ? 'solid' : 'outline'} className="mb-1" onPress={() => setRoleType(preset)} testID={`assignment-preset-${preset}`}>
                <ButtonText>{getIncidentRoleName(t, preset)}</ButtonText>
              </Button>
            ))}
          </HStack>
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.person_label')}</Text>
          <Input size="md" variant="outline">
            <InputField placeholder={t('command.search_personnel')} value={search} onChangeText={setSearch} testID="assignment-personnel-search" />
          </Input>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            <VStack space="xs">
              {filteredUsers.map((user) => (
                <Pressable
                  key={user.UserId}
                  testID={`assignment-person-${user.UserId}`}
                  className={`rounded-lg px-3 py-2 ${selectedUserId === user.UserId ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'}`}
                  onPress={() => setSelectedUserId(user.UserId)}
                >
                  <Text className={selectedUserId === user.UserId ? 'font-medium text-white' : 'text-gray-900 dark:text-white'}>
                    {user.FirstName} {user.LastName}
                  </Text>
                </Pressable>
              ))}
              {filteredUsers.length === 0 ? <Text className="py-2 text-center text-sm text-gray-500">{t('command.no_personnel_found')}</Text> : null}
            </VStack>
          </ScrollView>
        </VStack>

        <Button size="lg" onPress={handleSave} isDisabled={roleType === null || !selectedUserId} testID="assignment-save">
          <ButtonText>{t('command.add')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
