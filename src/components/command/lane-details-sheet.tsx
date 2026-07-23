import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type CommandStructureNode, type IncidentMap, type IncidentNeed, IncidentNeedStatus, type TacticalObjective, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/incidentCommandModels';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

/** One lead slot being edited: a Resgrid user OR an external contact. */
interface LeadDraft {
  userId: string | null;
  name: string;
  phone: string;
  email: string;
}

const emptyLead: LeadDraft = { userId: null, name: '', phone: '', email: '' };

const leadFromNode = (userId?: string | null, name?: string | null, phone?: string | null, email?: string | null): LeadDraft => ({
  userId: userId ?? null,
  name: name ?? '',
  phone: phone ?? '',
  email: email ?? '',
});

interface LaneDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  node: CommandStructureNode | null;
  objectives: TacticalObjective[];
  needs: IncidentNeed[];
  /** Named incident maps offered by the "attached map" picker. */
  maps?: IncidentMap[];
  users: PersonnelInfoResultData[];
  /** Persist the edited lane fields (merged into the stored lane by the caller). */
  onSave: (commandStructureNodeId: string, patch: Partial<CommandStructureNode>) => void;
}

/** Edit an existing lane: leads (primary/secondary — Resgrid user or external contact) and linked objectives/need. */
export const LaneDetailsSheet: React.FC<LaneDetailsSheetProps> = ({ isOpen, onClose, node, objectives, needs, maps, users, onSave }) => {
  const { t } = useTranslation();
  const [primaryLead, setPrimaryLead] = useState<LeadDraft>(emptyLead);
  const [secondaryLead, setSecondaryLead] = useState<LeadDraft>(emptyLead);
  const [primaryObjectiveId, setPrimaryObjectiveId] = useState<string | null>(null);
  const [secondaryObjectiveId, setSecondaryObjectiveId] = useState<string | null>(null);
  const [linkedNeedId, setLinkedNeedId] = useState<string | null>(null);
  const [linkedMapId, setLinkedMapId] = useState<string | null>(null);

  // Re-seed the draft each time a lane is opened
  useEffect(() => {
    if (node && isOpen) {
      setPrimaryLead(leadFromNode(node.PrimaryLeadUserId, node.PrimaryLeadName, node.PrimaryLeadPhone, node.PrimaryLeadEmail));
      setSecondaryLead(leadFromNode(node.SecondaryLeadUserId, node.SecondaryLeadName, node.SecondaryLeadPhone, node.SecondaryLeadEmail));
      setPrimaryObjectiveId(node.PrimaryObjectiveId ?? null);
      setSecondaryObjectiveId(node.SecondaryObjectiveId ?? null);
      setLinkedNeedId(node.LinkedNeedId ?? null);
      setLinkedMapId(node.LinkedMapId ?? null);
    }
  }, [node, isOpen]);

  const handleSave = useCallback(() => {
    if (!node) {
      return;
    }
    onSave(node.CommandStructureNodeId, {
      PrimaryLeadUserId: primaryLead.userId,
      PrimaryLeadName: primaryLead.userId ? null : primaryLead.name.trim() || null,
      PrimaryLeadPhone: primaryLead.userId ? null : primaryLead.phone.trim() || null,
      PrimaryLeadEmail: primaryLead.userId ? null : primaryLead.email.trim() || null,
      SecondaryLeadUserId: secondaryLead.userId,
      SecondaryLeadName: secondaryLead.userId ? null : secondaryLead.name.trim() || null,
      SecondaryLeadPhone: secondaryLead.userId ? null : secondaryLead.phone.trim() || null,
      SecondaryLeadEmail: secondaryLead.userId ? null : secondaryLead.email.trim() || null,
      PrimaryObjectiveId: primaryObjectiveId,
      SecondaryObjectiveId: secondaryObjectiveId,
      LinkedNeedId: linkedNeedId,
      LinkedMapId: linkedMapId,
    });
    onClose();
  }, [node, primaryLead, secondaryLead, primaryObjectiveId, secondaryObjectiveId, linkedNeedId, linkedMapId, onSave, onClose]);

  const openObjectives = objectives.filter((o) => o.Status !== TacticalObjectiveStatus.Complete);
  const openNeeds = needs.filter((n) => n.Status !== IncidentNeedStatus.Cancelled && n.Status !== IncidentNeedStatus.Met);

  const renderLeadEditor = (slot: 'primary' | 'secondary', lead: LeadDraft, setLead: (value: LeadDraft) => void) => (
    <VStack space="xs">
      <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{slot === 'primary' ? t('command.primary_lead_label') : t('command.secondary_lead_label')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack space="sm">
          <Button size="xs" variant={!lead.userId ? 'solid' : 'outline'} onPress={() => setLead({ ...lead, userId: null })} testID={`lane-lead-${slot}-external`}>
            <ButtonText>{t('command.lead_external_label')}</ButtonText>
          </Button>
          {users.map((user) => (
            <Button
              key={user.UserId}
              size="xs"
              variant={lead.userId === user.UserId ? 'solid' : 'outline'}
              onPress={() => setLead({ ...emptyLead, userId: lead.userId === user.UserId ? null : user.UserId })}
              testID={`lane-lead-${slot}-user-${user.UserId}`}
            >
              <ButtonText>{`${user.FirstName} ${user.LastName}`}</ButtonText>
            </Button>
          ))}
        </HStack>
      </ScrollView>
      {!lead.userId ? (
        <VStack space="xs">
          <Input size="sm" variant="outline">
            <InputField placeholder={t('command.lead_name_placeholder')} value={lead.name} onChangeText={(v) => setLead({ ...lead, name: v })} testID={`lane-lead-${slot}-name`} />
          </Input>
          <HStack space="sm">
            <Input size="sm" variant="outline" className="flex-1">
              <InputField keyboardType="phone-pad" placeholder={t('command.lead_phone_placeholder')} value={lead.phone} onChangeText={(v) => setLead({ ...lead, phone: v })} testID={`lane-lead-${slot}-phone`} />
            </Input>
            <Input size="sm" variant="outline" className="flex-1">
              <InputField
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={t('command.lead_email_placeholder')}
                value={lead.email}
                onChangeText={(v) => setLead({ ...lead, email: v })}
                testID={`lane-lead-${slot}-email`}
              />
            </Input>
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]}>
      <ScrollView className="w-full" showsVerticalScrollIndicator={false}>
        <VStack space="md" className="w-full pb-6">
          <Heading size="md">{node ? t('command.edit_lane_title', { lane: node.Name }) : t('command.edit_lane')}</Heading>

          {renderLeadEditor('primary', primaryLead, setPrimaryLead)}
          {renderLeadEditor('secondary', secondaryLead, setSecondaryLead)}

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.primary_objective_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              <Button size="xs" variant={!primaryObjectiveId ? 'solid' : 'outline'} className="mb-1" onPress={() => setPrimaryObjectiveId(null)} testID="lane-primary-objective-none">
                <ButtonText>{t('command.none_option')}</ButtonText>
              </Button>
              {openObjectives.map((objective) => (
                <Button
                  key={objective.TacticalObjectiveId}
                  size="xs"
                  variant={primaryObjectiveId === objective.TacticalObjectiveId ? 'solid' : 'outline'}
                  className="mb-1"
                  onPress={() => setPrimaryObjectiveId(objective.TacticalObjectiveId)}
                  testID={`lane-primary-objective-${objective.TacticalObjectiveId}`}
                >
                  <ButtonText>{objective.Name}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.secondary_objective_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              <Button size="xs" variant={!secondaryObjectiveId ? 'solid' : 'outline'} className="mb-1" onPress={() => setSecondaryObjectiveId(null)} testID="lane-secondary-objective-none">
                <ButtonText>{t('command.none_option')}</ButtonText>
              </Button>
              {openObjectives
                .filter((objective) => objective.TacticalObjectiveId !== primaryObjectiveId)
                .map((objective) => (
                  <Button
                    key={objective.TacticalObjectiveId}
                    size="xs"
                    variant={secondaryObjectiveId === objective.TacticalObjectiveId ? 'solid' : 'outline'}
                    className="mb-1"
                    onPress={() => setSecondaryObjectiveId(objective.TacticalObjectiveId)}
                    testID={`lane-secondary-objective-${objective.TacticalObjectiveId}`}
                  >
                    <ButtonText>{objective.Name}</ButtonText>
                  </Button>
                ))}
            </HStack>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.linked_need_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              <Button size="xs" variant={!linkedNeedId ? 'solid' : 'outline'} className="mb-1" onPress={() => setLinkedNeedId(null)} testID="lane-linked-need-none">
                <ButtonText>{t('command.none_option')}</ButtonText>
              </Button>
              {openNeeds.map((need) => (
                <Button
                  key={need.IncidentNeedId}
                  size="xs"
                  variant={linkedNeedId === need.IncidentNeedId ? 'solid' : 'outline'}
                  className="mb-1"
                  onPress={() => setLinkedNeedId(need.IncidentNeedId)}
                  testID={`lane-linked-need-${need.IncidentNeedId}`}
                >
                  <ButtonText>{need.Name}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.linked_map_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              <Button size="xs" variant={!linkedMapId ? 'solid' : 'outline'} className="mb-1" onPress={() => setLinkedMapId(null)} testID="lane-linked-map-none">
                <ButtonText>{t('command.none_option')}</ButtonText>
              </Button>
              {(maps ?? []).map((map) => (
                <Button
                  key={map.IncidentMapId}
                  size="xs"
                  variant={linkedMapId === map.IncidentMapId ? 'solid' : 'outline'}
                  className="mb-1"
                  onPress={() => setLinkedMapId(map.IncidentMapId)}
                  testID={`lane-linked-map-${map.IncidentMapId}`}
                >
                  <ButtonText>{map.Name}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          <Button size="lg" onPress={handleSave} isDisabled={!node} testID="lane-details-save">
            <ButtonText>{t('command.save')}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </CustomBottomSheet>
  );
};
