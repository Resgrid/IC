import { MapPin, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';

import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { type IncidentCommand, type UpdateCommandInfoInput } from '@/models/v4/incidentCommand/incidentCommandModels';

/** Quick-select offsets (hours from now) for the estimated incident end. */
const ESTIMATED_END_OFFSETS = [1, 2, 4, 8, 12];

/** Quick-adjust offsets (minutes) for correcting the incident start time. */
const START_ADJUST_OFFSETS = [-60, -30, -15, 15, 30, 60];

interface LocationValue {
  text: string;
  latitude: string;
  longitude: string;
}

type LocationSlot = 'commandPost' | 'staging' | 'rehab';

interface CommandDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  command: IncidentCommand | null;
  onSave: (info: Omit<UpdateCommandInfoInput, 'IncidentCommandId'>) => void;
}

const emptyLocation = (): LocationValue => ({ text: '', latitude: '', longitude: '' });

const locationFrom = (text?: string | null, latitude?: string | null, longitude?: string | null): LocationValue => ({
  text: text ?? '',
  latitude: latitude ?? '',
  longitude: longitude ?? '',
});

/** One location row: free-text description + coordinates with a drop-a-pin map picker. */
const LocationEditor: React.FC<{
  label: string;
  value: LocationValue;
  onChangeText: (text: string) => void;
  onPick: () => void;
  onClearCoordinates: () => void;
  testID: string;
}> = ({ label, value, onChangeText, onPick, onClearCoordinates, testID }) => {
  const { t } = useTranslation();
  const hasCoordinates = Boolean(value.latitude && value.longitude);

  return (
    <VStack space="xs">
      <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</Text>
      <Input size="md">
        <InputField placeholder={t('command.location_placeholder')} value={value.text} onChangeText={onChangeText} testID={`${testID}-text`} />
      </Input>
      <HStack space="sm" className="items-center">
        <Button size="xs" variant="outline" onPress={onPick} testID={`${testID}-pick`}>
          <ButtonIcon as={MapPin} />
          <ButtonText>{t('command.pick_on_map')}</ButtonText>
        </Button>
        {hasCoordinates ? (
          <>
            <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {`${value.latitude}, ${value.longitude}`}
            </Text>
            <Button size="xs" variant="outline" onPress={onClearCoordinates} testID={`${testID}-clear`}>
              <ButtonIcon as={X} />
            </Button>
          </>
        ) : (
          <Text className="flex-1 text-xs text-gray-400 dark:text-gray-500">{t('command.location_geocode_hint')}</Text>
        )}
      </HStack>
    </VStack>
  );
};

/**
 * Edit core incident info: name, corrected start time, estimated end, important information, and the
 * ICP/HQ, Staging, and Rehab locations (free text and/or a dropped map pin — text-only locations are
 * geocoded server-side on save).
 */
export const CommandDetailsSheet: React.FC<CommandDetailsSheetProps> = ({ isOpen, onClose, command, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [establishedOn, setEstablishedOn] = useState<string | null>(null);
  const [estimatedEndOn, setEstimatedEndOn] = useState<string | null>(null);
  const [importantInformation, setImportantInformation] = useState('');
  const [commandPost, setCommandPost] = useState<LocationValue>(emptyLocation());
  const [staging, setStaging] = useState<LocationValue>(emptyLocation());
  const [rehab, setRehab] = useState<LocationValue>(emptyLocation());
  const [pickerTarget, setPickerTarget] = useState<LocationSlot | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(command?.Name ?? '');
      setEstablishedOn(command?.EstablishedOn ?? null);
      setEstimatedEndOn(command?.EstimatedEndOn ?? null);
      setImportantInformation(command?.ImportantInformation ?? '');
      setCommandPost(locationFrom(command?.CommandPostLocationText, command?.CommandPostLatitude, command?.CommandPostLongitude));
      setStaging(locationFrom(command?.StagingLocationText, command?.StagingLatitude, command?.StagingLongitude));
      setRehab(locationFrom(command?.RehabLocationText, command?.RehabLatitude, command?.RehabLongitude));
      setPickerTarget(null);
    }
  }, [command, isOpen]);

  const handleSave = useCallback(() => {
    onSave({
      Name: name.trim(),
      EstablishedOn: establishedOn,
      EstimatedEndOn: estimatedEndOn,
      ClearEstimatedEndOn: estimatedEndOn === null,
      ImportantInformation: importantInformation.trim(),
      CommandPostLocationText: commandPost.text.trim(),
      CommandPostLatitude: commandPost.latitude,
      CommandPostLongitude: commandPost.longitude,
      StagingLocationText: staging.text.trim(),
      StagingLatitude: staging.latitude,
      StagingLongitude: staging.longitude,
      RehabLocationText: rehab.text.trim(),
      RehabLatitude: rehab.latitude,
      RehabLongitude: rehab.longitude,
    });
    onClose();
  }, [name, establishedOn, estimatedEndOn, importantInformation, commandPost, staging, rehab, onSave, onClose]);

  const adjustStart = useCallback(
    (minutes: number) => {
      const base = establishedOn ? new Date(establishedOn).getTime() : Date.now();
      setEstablishedOn(new Date(base + minutes * 60 * 1000).toISOString());
    },
    [establishedOn]
  );

  const setEndOffset = useCallback((hours: number) => {
    setEstimatedEndOn(new Date(Date.now() + hours * 60 * 60 * 1000).toISOString());
  }, []);

  const setterFor = useCallback((slot: LocationSlot) => (slot === 'commandPost' ? setCommandPost : slot === 'staging' ? setStaging : setRehab), []);

  const pickerInitial = useCallback(() => {
    const value = pickerTarget === 'commandPost' ? commandPost : pickerTarget === 'staging' ? staging : rehab;
    const latitude = parseFloat(value.latitude);
    const longitude = parseFloat(value.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;
  }, [pickerTarget, commandPost, staging, rehab]);

  const handleLocationPicked = useCallback(
    (location: { latitude: number; longitude: number; address?: string }) => {
      if (!pickerTarget) {
        return;
      }
      setterFor(pickerTarget)((current) => ({
        text: current.text || location.address || '',
        latitude: location.latitude.toFixed(6),
        longitude: location.longitude.toFixed(6),
      }));
      setPickerTarget(null);
    },
    [pickerTarget, setterFor]
  );

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]} testID="command-info-sheet">
      <VStack space="md" className="w-full">
        <Heading size="md">{t('command.incident_info_title')}</Heading>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.incident_name_label')}</Text>
          <Input size="md">
            <InputField placeholder={t('command.incident_name_placeholder')} value={name} onChangeText={setName} testID="command-info-name" />
          </Input>
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.start_time_label')}</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300" testID="command-info-start-display">
            {establishedOn ? new Date(establishedOn).toLocaleString() : '—'}
          </Text>
          <HStack className="flex-wrap" space="sm">
            {START_ADJUST_OFFSETS.map((minutes) => (
              <Button key={minutes} size="xs" variant="outline" className="mb-1" onPress={() => adjustStart(minutes)} testID={`command-info-start-${minutes}`}>
                <ButtonText>{minutes > 0 ? `+${minutes}m` : `${minutes}m`}</ButtonText>
              </Button>
            ))}
            <Button size="xs" variant="outline" className="mb-1" onPress={() => setEstablishedOn(new Date().toISOString())} testID="command-info-start-now">
              <ButtonText>{t('command.start_time_now')}</ButtonText>
            </Button>
          </HStack>
        </VStack>

        <LocationEditor
          label={t('command.icp_location_label')}
          value={commandPost}
          onChangeText={(text) => setCommandPost((current) => ({ ...current, text }))}
          onPick={() => setPickerTarget('commandPost')}
          onClearCoordinates={() => setCommandPost((current) => ({ ...current, latitude: '', longitude: '' }))}
          testID="command-info-icp"
        />
        <LocationEditor
          label={t('command.staging_location_label')}
          value={staging}
          onChangeText={(text) => setStaging((current) => ({ ...current, text }))}
          onPick={() => setPickerTarget('staging')}
          onClearCoordinates={() => setStaging((current) => ({ ...current, latitude: '', longitude: '' }))}
          testID="command-info-staging"
        />
        <LocationEditor
          label={t('command.rehab_location_label')}
          value={rehab}
          onChangeText={(text) => setRehab((current) => ({ ...current, text }))}
          onPick={() => setPickerTarget('rehab')}
          onClearCoordinates={() => setRehab((current) => ({ ...current, latitude: '', longitude: '' }))}
          testID="command-info-rehab"
        />

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.estimated_end_label')}</Text>
          <HStack className="flex-wrap" space="sm">
            {ESTIMATED_END_OFFSETS.map((hours) => (
              <Button key={hours} size="xs" variant="outline" className="mb-1" onPress={() => setEndOffset(hours)} testID={`command-est-end-${hours}`}>
                <ButtonText>{`+${hours}h`}</ButtonText>
              </Button>
            ))}
            <Button size="xs" variant={estimatedEndOn ? 'outline' : 'solid'} className="mb-1" onPress={() => setEstimatedEndOn(null)} testID="command-est-end-clear">
              <ButtonText>{t('command.est_end_none')}</ButtonText>
            </Button>
          </HStack>
          {estimatedEndOn ? <Text className="text-sm text-gray-600 dark:text-gray-300">{new Date(estimatedEndOn).toLocaleString()}</Text> : null}
        </VStack>

        <VStack space="xs">
          <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.important_information_label')}</Text>
          <Textarea size="md" className="h-24">
            <TextareaInput placeholder={t('command.important_information_placeholder')} value={importantInformation} onChangeText={setImportantInformation} testID="command-important-info-input" multiline />
          </Textarea>
        </VStack>

        <Button size="lg" onPress={handleSave} testID="command-details-save">
          <ButtonText>{t('command.save')}</ButtonText>
        </Button>
      </VStack>

      {/* Drop-a-pin picker rendered as a stacked modal so it covers the sheet full-screen */}
      <Modal visible={pickerTarget !== null} animationType="slide" onRequestClose={() => setPickerTarget(null)}>
        <View style={{ flex: 1 }}>{pickerTarget !== null ? <FullScreenLocationPicker initialLocation={pickerInitial()} onLocationSelected={handleLocationPicked} onClose={() => setPickerTarget(null)} /> : null}</View>
      </Modal>
    </CustomBottomSheet>
  );
};
