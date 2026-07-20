import { Check } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';
import type { UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

export type AdHocResourceKind = 'unit' | 'person';

type ResourceTab = 'units' | 'personnel' | 'external';

interface AddResourceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Department unit roster — the default resource pool. */
  units: UnitResultData[];
  /** Department personnel roster — the default resource pool. */
  personnel: PersonnelInfoResultData[];
  /** Live per-unit statuses, for the status badge on unit rows. */
  unitCurrentStatuses?: UnitStatusResultData[];
  /** Unit ids already tracked on this incident (rendered as added, not addable twice). */
  trackedUnitIds: string[];
  /** User ids already tracked on this incident. */
  trackedUserIds: string[];
  /** Track a department unit on the incident. */
  onAddUnit: (unitId: string) => void;
  /** Track a department person on the incident. */
  onAddPersonnel: (userId: string) => void;
  /** Add an external (non-Resgrid) unit or person: mutual aid, temp staff, volunteer, contractor. */
  onSaveExternal: (kind: AdHocResourceKind, name: string, detail?: string, agency?: string) => void;
}

// eslint-disable-next-line max-lines-per-function
export const AddResourceSheet: React.FC<AddResourceSheetProps> = ({ isOpen, onClose, units, personnel, unitCurrentStatuses = [], trackedUnitIds, trackedUserIds, onAddUnit, onAddPersonnel, onSaveExternal }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ResourceTab>('units');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<AdHocResourceKind>('unit');
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [agency, setAgency] = useState('');

  const normalizedSearch = search.trim().toLowerCase();

  const visibleUnits = useMemo(() => {
    const list = normalizedSearch ? units.filter((u) => `${u.Name} ${u.Type} ${u.GroupName}`.toLowerCase().includes(normalizedSearch)) : units;
    return list.slice(0, 50);
  }, [units, normalizedSearch]);

  const visiblePersonnel = useMemo(() => {
    const list = normalizedSearch ? personnel.filter((p) => `${p.FirstName} ${p.LastName} ${p.GroupName}`.toLowerCase().includes(normalizedSearch)) : personnel;
    return list.slice(0, 50);
  }, [personnel, normalizedSearch]);

  const trackedUnits = useMemo(() => new Set(trackedUnitIds), [trackedUnitIds]);
  const trackedUsers = useMemo(() => new Set(trackedUserIds), [trackedUserIds]);

  const handleSaveExternal = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    onSaveExternal(kind, name.trim(), detail.trim() || undefined, agency.trim() || undefined);
    setName('');
    setDetail('');
    setAgency('');
    onClose();
  }, [kind, name, detail, agency, onSaveExternal, onClose]);

  const handleTabChange = useCallback((next: ResourceTab) => {
    setTab(next);
    setSearch('');
  }, []);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.add_resource')}</Heading>

        {/* Department units / personnel are the default; external covers mutual aid & non-Resgrid people */}
        <HStack space="sm">
          <Button size="xs" variant={tab === 'units' ? 'solid' : 'outline'} onPress={() => handleTabChange('units')} testID="resource-tab-units">
            <ButtonText>{t('command.resource_kind_units')}</ButtonText>
          </Button>
          <Button size="xs" variant={tab === 'personnel' ? 'solid' : 'outline'} onPress={() => handleTabChange('personnel')} testID="resource-tab-personnel">
            <ButtonText>{t('command.resource_kind_personnel')}</ButtonText>
          </Button>
          <Button size="xs" variant={tab === 'external' ? 'solid' : 'outline'} onPress={() => handleTabChange('external')} testID="resource-tab-external">
            <ButtonText>{t('command.resource_kind_external')}</ButtonText>
          </Button>
        </HStack>

        {tab !== 'external' ? (
          <>
            <Input size="md" variant="outline">
              <InputField placeholder={tab === 'units' ? t('command.search_resources') : t('command.search_personnel')} value={search} onChangeText={setSearch} testID="resource-roster-search" />
            </Input>

            <ScrollView style={styles.rosterList} nestedScrollEnabled>
              <VStack space="xs">
                {tab === 'units'
                  ? visibleUnits.map((unit) => {
                      const isTracked = trackedUnits.has(unit.UnitId);
                      const subtitle = [unit.Type, unit.GroupName].filter(Boolean).join(' • ');
                      const liveState = unitCurrentStatuses.find((s) => s.UnitId === unit.UnitId)?.State;
                      return (
                        <Pressable
                          key={unit.UnitId}
                          disabled={isTracked}
                          className={`rounded-lg px-3 py-2 ${isTracked ? 'bg-gray-50 opacity-60 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800'}`}
                          onPress={() => onAddUnit(unit.UnitId)}
                          testID={`roster-unit-${unit.UnitId}`}
                        >
                          <HStack className="items-center justify-between" space="sm">
                            <VStack className="min-w-0 flex-1">
                              <Text className="font-medium text-gray-900 dark:text-white">{unit.Name}</Text>
                              {subtitle ? <Text className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</Text> : null}
                            </VStack>
                            {liveState ? (
                              <Badge action="muted" variant="outline">
                                <BadgeText>{liveState}</BadgeText>
                              </Badge>
                            ) : null}
                            {isTracked ? <Icon as={Check} size="sm" className="text-success-600" /> : null}
                          </HStack>
                        </Pressable>
                      );
                    })
                  : visiblePersonnel.map((person) => {
                      const isTracked = trackedUsers.has(person.UserId);
                      const subtitle = [person.GroupName, person.Status].filter(Boolean).join(' • ');
                      return (
                        <Pressable
                          key={person.UserId}
                          disabled={isTracked}
                          className={`rounded-lg px-3 py-2 ${isTracked ? 'bg-gray-50 opacity-60 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800'}`}
                          onPress={() => onAddPersonnel(person.UserId)}
                          testID={`roster-person-${person.UserId}`}
                        >
                          <HStack className="items-center justify-between">
                            <HStack space="sm" className="flex-1 items-center">
                              {person.StatusColor ? <View style={[styles.statusDot, { backgroundColor: person.StatusColor }]} /> : null}
                              <VStack className="flex-1">
                                <Text className="font-medium text-gray-900 dark:text-white">{`${person.FirstName} ${person.LastName}`}</Text>
                                {subtitle ? <Text className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</Text> : null}
                              </VStack>
                            </HStack>
                            {isTracked ? <Icon as={Check} size="sm" className="text-success-600" /> : null}
                          </HStack>
                          {person.Roles && person.Roles.length > 0 ? (
                            <HStack className="mt-1 flex-wrap" space="xs">
                              {person.Roles.map((role) => (
                                <Badge key={role} action="info" variant="outline">
                                  <BadgeText>{role}</BadgeText>
                                </Badge>
                              ))}
                            </HStack>
                          ) : null}
                        </Pressable>
                      );
                    })}
                {(tab === 'units' ? visibleUnits : visiblePersonnel).length === 0 ? (
                  <Text className="py-2 text-center text-sm text-gray-500">{tab === 'units' ? t('command.no_resources_found') : t('command.no_personnel_found')}</Text>
                ) : null}
              </VStack>
            </ScrollView>
          </>
        ) : (
          <>
            {/* External unit vs external person */}
            <HStack space="sm">
              <Button size="xs" variant={kind === 'unit' ? 'solid' : 'outline'} onPress={() => setKind('unit')} testID="resource-kind-unit">
                <ButtonText>{t('command.resource_unit')}</ButtonText>
              </Button>
              <Button size="xs" variant={kind === 'person' ? 'solid' : 'outline'} onPress={() => setKind('person')} testID="resource-kind-person">
                <ButtonText>{t('command.resource_person')}</ButtonText>
              </Button>
            </HStack>

            <VStack space="xs">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{kind === 'unit' ? t('command.resource_name_label') : t('command.person_label')}</Text>
              <Input size="md" variant="outline">
                <InputField placeholder={kind === 'unit' ? t('command.resource_name_placeholder') : t('command.person_name_placeholder')} value={name} onChangeText={setName} testID="resource-name-input" />
              </Input>
            </VStack>

            <VStack space="xs">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{kind === 'unit' ? t('command.note_label') : t('command.person_role_label')}</Text>
              <Input size="md" variant="outline">
                <InputField placeholder={kind === 'unit' ? t('command.note_placeholder') : t('command.person_role_placeholder')} value={detail} onChangeText={setDetail} testID="resource-note-input" />
              </Input>
            </VStack>

            {kind === 'person' ? (
              <VStack space="xs">
                <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.agency_label')}</Text>
                <Input size="md" variant="outline">
                  <InputField placeholder={t('command.agency_placeholder')} value={agency} onChangeText={setAgency} testID="resource-agency-input" />
                </Input>
              </VStack>
            ) : null}

            <Button size="lg" onPress={handleSaveExternal} isDisabled={!name.trim()} testID="resource-save">
              <ButtonText>{t('command.add')}</ButtonText>
            </Button>
          </>
        )}
      </VStack>
    </CustomBottomSheet>
  );
};

const styles = StyleSheet.create({
  rosterList: {
    maxHeight: 320,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
