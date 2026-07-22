import { router } from 'expo-router';
import { Map as MapIcon, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
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
import { type IncidentMap } from '@/models/v4/incidentCommand/incidentCommandModels';

/** Quick-select expiry offsets (hours from now) for a named map. */
const EXPIRY_OFFSETS = [12, 24, 48, 168];

interface IncidentMapsSectionProps {
  callId: string;
  maps: IncidentMap[];
  /** Create a named map (framing gets pinned afterwards in the fullscreen editor). */
  onCreate: (name: string, description: string | null, expiresOn: string | null) => void;
  onDelete: (incidentMapId: string) => void;
  /** Resolve a user id to a display name for the audit line. */
  resolveUserName?: (userId: string) => string;
}

export const isMapExpired = (map: IncidentMap): boolean => Boolean(map.ExpiresOn && new Date(map.ExpiresOn).getTime() < Date.now());

/**
 * Named tactical maps for the incident — each with its own framing, markup, description, optional
 * expiry, and audit trail. Tapping a map opens it in the fullscreen editor.
 */
export const IncidentMapsSection: React.FC<IncidentMapsSectionProps> = ({ callId, maps, onCreate, onDelete, resolveUserName }) => {
  const { t } = useTranslation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    onCreate(name.trim(), description.trim() || null, expiresOn);
    setName('');
    setDescription('');
    setExpiresOn(null);
    setIsAddOpen(false);
  }, [name, description, expiresOn, onCreate]);

  const auditLine = useCallback(
    (map: IncidentMap) => {
      if (map.UpdatedByUserId && map.UpdatedOn) {
        return t('command.incident_maps_updated_by', { name: resolveUserName?.(map.UpdatedByUserId) ?? map.UpdatedByUserId, when: new Date(map.UpdatedOn).toLocaleString() });
      }
      if (map.CreatedByUserId) {
        return t('command.incident_maps_created_by', { name: resolveUserName?.(map.CreatedByUserId) ?? map.CreatedByUserId, when: new Date(map.CreatedOn).toLocaleString() });
      }
      return null;
    },
    [t, resolveUserName]
  );

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-incident-maps-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Icon as={MapIcon} size="sm" className="text-gray-500" />
          <Heading size="sm">{t('command.incident_maps_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({maps.length})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={() => setIsAddOpen(true)} testID="incident-maps-add">
          <ButtonIcon as={Plus} />
          <ButtonText>{t('command.add')}</ButtonText>
        </Button>
      </HStack>

      {maps.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.incident_maps_empty')}</Text>
      ) : (
        <VStack space="sm">
          {maps.map((map) => (
            <Pressable key={map.IncidentMapId} onPress={() => router.push(`/command-map/${callId}?mapId=${encodeURIComponent(map.IncidentMapId)}` as never)} testID={`incident-map-${map.IncidentMapId}`}>
              <HStack className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                <VStack className="min-w-0 flex-1 pr-2">
                  <HStack space="sm" className="items-center">
                    <Text className="min-w-0 flex-1 text-base text-gray-900 dark:text-white" numberOfLines={1}>
                      {map.Name}
                    </Text>
                    {isMapExpired(map) ? (
                      <Badge action="warning" size="sm" testID={`incident-map-expired-${map.IncidentMapId}`}>
                        <BadgeText>{t('command.incident_maps_expired')}</BadgeText>
                      </Badge>
                    ) : map.ExpiresOn ? (
                      <Badge action="muted" size="sm">
                        <BadgeText>{t('command.incident_maps_expires', { when: new Date(map.ExpiresOn).toLocaleString() })}</BadgeText>
                      </Badge>
                    ) : null}
                  </HStack>
                  {map.Description ? (
                    <Text className="text-sm text-gray-600 dark:text-gray-300" numberOfLines={2}>
                      {map.Description}
                    </Text>
                  ) : null}
                  {auditLine(map) ? <Text className="text-xs text-gray-500 dark:text-gray-400">{auditLine(map)}</Text> : null}
                </VStack>
                <Pressable onPress={() => setPendingDeleteId(map.IncidentMapId)} className="p-2" testID={`incident-map-delete-${map.IncidentMapId}`}>
                  <Icon as={Trash2} size="sm" className="text-gray-400" />
                </Pressable>
              </HStack>
            </Pressable>
          ))}
        </VStack>
      )}

      <CustomBottomSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} snapPoints={[55]} testID="incident-map-add-sheet">
        <VStack space="md" className="w-full">
          <Heading size="md">{t('command.incident_maps_add_title')}</Heading>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.incident_maps_name_label')}</Text>
            <Input size="md">
              <InputField placeholder={t('command.incident_maps_name_placeholder')} value={name} onChangeText={setName} testID="incident-map-name-input" />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.incident_maps_description_label')}</Text>
            <Input size="md">
              <InputField placeholder={t('command.incident_maps_description_placeholder')} value={description} onChangeText={setDescription} testID="incident-map-description-input" />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.incident_maps_expiry_label')}</Text>
            <HStack className="flex-wrap" space="sm">
              <Button size="xs" variant={expiresOn === null ? 'solid' : 'outline'} className="mb-1" onPress={() => setExpiresOn(null)} testID="incident-map-expiry-none">
                <ButtonText>{t('command.est_end_none')}</ButtonText>
              </Button>
              {EXPIRY_OFFSETS.map((hours) => (
                <Button key={hours} size="xs" variant="outline" className="mb-1" onPress={() => setExpiresOn(new Date(Date.now() + hours * 60 * 60 * 1000).toISOString())} testID={`incident-map-expiry-${hours}`}>
                  <ButtonText>{hours >= 24 ? `+${hours / 24}d` : `+${hours}h`}</ButtonText>
                </Button>
              ))}
            </HStack>
            {expiresOn ? <Text className="text-sm text-gray-600 dark:text-gray-300">{new Date(expiresOn).toLocaleString()}</Text> : null}
          </VStack>

          <Button size="lg" onPress={handleCreate} isDisabled={!name.trim()} testID="incident-map-create-save">
            <ButtonText>{t('command.add')}</ButtonText>
          </Button>
        </VStack>
      </CustomBottomSheet>

      <AlertDialog isOpen={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="incident-map-delete-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.incident_maps_delete_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">{t('command.incident_maps_delete_message')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setPendingDeleteId(null)} testID="incident-map-delete-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={() => {
                const id = pendingDeleteId;
                setPendingDeleteId(null);
                if (id) {
                  onDelete(id);
                }
              }}
              testID="incident-map-delete-confirm"
            >
              <ButtonText>{t('command.incident_map_delete')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
};
