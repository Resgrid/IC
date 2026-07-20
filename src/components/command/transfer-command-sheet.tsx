import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

interface TransferCommandSheetProps {
  isOpen: boolean;
  onClose: () => void;
  personnel: PersonnelInfoResultData[];
  /** User id of the current incident commander — shown as such and not selectable. */
  currentCommanderUserId?: string;
  onTransfer: (toUserId: string) => void;
}

/** Hand incident command to another user — Tablet Command's "transfer of command". */
export const TransferCommandSheet: React.FC<TransferCommandSheetProps> = ({ isOpen, onClose, personnel, currentCommanderUserId, onTransfer }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const visiblePersonnel = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = normalized ? personnel.filter((p) => `${p.FirstName} ${p.LastName} ${p.GroupName}`.toLowerCase().includes(normalized)) : personnel;
    return list.slice(0, 50);
  }, [personnel, search]);

  const handleTransfer = useCallback(() => {
    if (!selectedUserId) {
      return;
    }
    onTransfer(selectedUserId);
    setSelectedUserId(null);
    setSearch('');
    onClose();
  }, [selectedUserId, onTransfer, onClose]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[75]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.transfer_command')}</Heading>
        <Text className="text-sm text-gray-500 dark:text-gray-400">{t('command.transfer_command_hint')}</Text>

        <Input size="md" variant="outline">
          <InputField placeholder={t('command.search_personnel')} value={search} onChangeText={setSearch} testID="transfer-search" />
        </Input>

        <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
          <VStack space="xs">
            {visiblePersonnel.map((person) => {
              const isCommander = person.UserId === currentCommanderUserId;
              const isSelected = selectedUserId === person.UserId;
              const subtitle = [person.GroupName, person.Status].filter(Boolean).join(' • ');
              return (
                <Pressable
                  key={person.UserId}
                  disabled={isCommander}
                  className={`rounded-lg px-3 py-2 ${isSelected ? 'bg-primary-500' : isCommander ? 'bg-gray-50 opacity-60 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800'}`}
                  onPress={() => setSelectedUserId(person.UserId)}
                  testID={`transfer-person-${person.UserId}`}
                >
                  <HStack className="items-center justify-between" space="sm">
                    <VStack className="min-w-0 flex-1">
                      <Text className={isSelected ? 'font-medium text-white' : 'font-medium text-gray-900 dark:text-white'}>{`${person.FirstName} ${person.LastName}`}</Text>
                      {subtitle ? <Text className={`text-xs ${isSelected ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'}`}>{subtitle}</Text> : null}
                    </VStack>
                    {isCommander ? (
                      <Badge action="info" variant="outline">
                        <BadgeText>{t('command.current_commander')}</BadgeText>
                      </Badge>
                    ) : null}
                  </HStack>
                </Pressable>
              );
            })}
            {visiblePersonnel.length === 0 ? <Text className="py-2 text-center text-sm text-gray-500">{t('command.no_personnel_found')}</Text> : null}
          </VStack>
        </ScrollView>

        <Button size="lg" onPress={handleTransfer} isDisabled={!selectedUserId} testID="transfer-confirm">
          <ButtonText>{t('command.transfer')}</ButtonText>
        </Button>
      </VStack>
    </CustomBottomSheet>
  );
};
