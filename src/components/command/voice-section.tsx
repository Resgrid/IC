import { Mic, MicOff, Phone, PhoneOff, Plus, RadioTower } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { parseUtcMs } from '@/lib/utils';
import type { IncidentVoiceChannel, VoiceTransmissionLog } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useLiveKitStore } from '@/stores/app/livekit-store';

/** Quick-create channel name keys — the two channels every incident wants first. */
const CHANNEL_PRESET_KEYS = ['channel_preset_tactical', 'channel_preset_command'];

interface VoiceSectionProps {
  callId: string;
  channels: IncidentVoiceChannel[];
  transmissionLog: VoiceTransmissionLog[];
  personName: (userId: string) => string;
  onCreateChannel: (name: string) => void;
  onCloseChannels: () => void;
  /** Record one completed local PTT transmission (start/end ISO strings). */
  onTransmission: (departmentVoiceChannelId: string, startedOn: string, endedOn: string) => void;
}

const formatLogTime = (iso: string) => {
  const ms = parseUtcMs(iso);
  return ms === null ? '' : new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const transmissionSeconds = (log: VoiceTransmissionLog) => {
  const start = parseUtcMs(log.StartedOn);
  const end = parseUtcMs(log.EndedOn);
  if (start === null || end === null) {
    return null;
  }
  return Math.max(0, Math.round((end - start) / 1000));
};

/** Tactical/command PTT channels for the incident (Resgrid Voice/LiveKit addon) plus the transmission log. */
// eslint-disable-next-line max-lines-per-function
export const VoiceSection: React.FC<VoiceSectionProps> = ({ callId, channels, transmissionLog, personName, onCreateChannel, onCloseChannels, onTransmission }) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [channelName, setChannelName] = useState('');

  const availableRooms = useLiveKitStore((state) => state.availableRooms);
  const currentRoomInfo = useLiveKitStore((state) => state.currentRoomInfo);
  const isMicrophoneEnabled = useLiveKitStore((state) => state.isMicrophoneEnabled);
  const connectToRoom = useLiveKitStore((state) => state.connectToRoom);
  const disconnectFromRoom = useLiveKitStore((state) => state.disconnectFromRoom);
  const setMicrophoneEnabled = useLiveKitStore((state) => state.setMicrophoneEnabled);
  const fetchVoiceSettings = useLiveKitStore((state) => state.fetchVoiceSettings);

  // Voice settings carry the LiveKit tokens for every channel (incident channels included)
  useEffect(() => {
    if (channels.length > 0 && availableRooms.length === 0) {
      fetchVoiceSettings();
    }
  }, [channels.length, availableRooms.length, fetchVoiceSettings]);

  const connectedChannel = channels.find((c) => currentRoomInfo?.Id === c.DepartmentVoiceChannelId);

  // Local PTT transmission log: mic-on → mic-off on an incident channel = one transmission
  const transmitStartRef = useRef<string | null>(null);
  useEffect(() => {
    if (!connectedChannel) {
      transmitStartRef.current = null;
      return;
    }
    if (isMicrophoneEnabled && !transmitStartRef.current) {
      transmitStartRef.current = new Date().toISOString();
    } else if (!isMicrophoneEnabled && transmitStartRef.current) {
      const startedOn = transmitStartRef.current;
      transmitStartRef.current = null;
      onTransmission(connectedChannel.DepartmentVoiceChannelId, startedOn, new Date().toISOString());
    }
  }, [isMicrophoneEnabled, connectedChannel, onTransmission]);

  const handleJoin = useCallback(
    async (channel: IncidentVoiceChannel) => {
      let room = availableRooms.find((r) => r.Id === channel.DepartmentVoiceChannelId);
      if (!room) {
        await fetchVoiceSettings();
        room = useLiveKitStore.getState().availableRooms.find((r) => r.Id === channel.DepartmentVoiceChannelId);
      }
      if (room?.Token) {
        await connectToRoom(room, room.Token);
      }
    },
    [availableRooms, connectToRoom, fetchVoiceSettings]
  );

  const handleCreate = useCallback(() => {
    const trimmed = channelName.trim();
    if (!trimmed) {
      return;
    }
    onCreateChannel(trimmed);
    setChannelName('');
    setIsAdding(false);
  }, [channelName, onCreateChannel]);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-voice-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.voice_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({channels.length})</Text>
        </HStack>
        <HStack space="sm">
          {channels.length > 0 ? (
            <Button size="xs" variant="outline" action="negative" onPress={onCloseChannels} testID="command-voice-close-all">
              <ButtonText>{t('command.close_channels')}</ButtonText>
            </Button>
          ) : null}
          <Button size="xs" variant="outline" onPress={() => setIsAdding((v) => !v)} testID="command-voice-add">
            <ButtonIcon as={Plus} />
            <ButtonText>{t('command.add_channel')}</ButtonText>
          </Button>
        </HStack>
      </HStack>

      {isAdding ? (
        <VStack space="sm" className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900" testID="command-voice-form">
          <HStack space="sm">
            {CHANNEL_PRESET_KEYS.map((key) => (
              <Button key={key} size="xs" variant="outline" onPress={() => setChannelName(t(`command.${key}`))} testID={`channel-preset-${key}`}>
                <ButtonText>{t(`command.${key}`)}</ButtonText>
              </Button>
            ))}
          </HStack>
          <HStack space="sm" className="items-center">
            <Input size="md" variant="outline" className="flex-1">
              <InputField placeholder={t('command.channel_name_placeholder')} value={channelName} onChangeText={setChannelName} testID="channel-name-input" />
            </Input>
            <Button size="sm" onPress={handleCreate} isDisabled={!channelName.trim()} testID="channel-create">
              <ButtonText>{t('command.add')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      ) : null}

      {channels.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_channels')}</Text>
      ) : (
        <VStack space="sm">
          {channels.map((channel) => {
            const isConnected = connectedChannel?.DepartmentVoiceChannelId === channel.DepartmentVoiceChannelId;
            return (
              <HStack key={channel.DepartmentVoiceChannelId} className="items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`voice-channel-${channel.DepartmentVoiceChannelId}`}>
                <HStack space="sm" className="min-w-0 flex-1 items-center">
                  <RadioTower className={isConnected ? 'text-success-600' : 'text-gray-400'} size={18} />
                  <Text className="min-w-0 flex-1 font-medium text-gray-900 dark:text-white">{channel.Name}</Text>
                  {isConnected ? (
                    <Badge action="success" variant="solid">
                      <BadgeText className="text-white">{t('command.channel_connected')}</BadgeText>
                    </Badge>
                  ) : null}
                </HStack>
                <HStack space="sm" className="items-center">
                  {isConnected ? (
                    <>
                      <Button
                        size="xs"
                        variant={isMicrophoneEnabled ? 'solid' : 'outline'}
                        action={isMicrophoneEnabled ? 'positive' : 'secondary'}
                        onPress={() => setMicrophoneEnabled(!isMicrophoneEnabled)}
                        testID={`voice-ptt-${channel.DepartmentVoiceChannelId}`}
                      >
                        <ButtonIcon as={isMicrophoneEnabled ? Mic : MicOff} />
                      </Button>
                      <Button size="xs" variant="outline" action="negative" onPress={() => disconnectFromRoom()} testID={`voice-leave-${channel.DepartmentVoiceChannelId}`}>
                        <ButtonIcon as={PhoneOff} />
                        <ButtonText>{t('command.channel_leave')}</ButtonText>
                      </Button>
                    </>
                  ) : (
                    <Button size="xs" variant="outline" onPress={() => handleJoin(channel)} testID={`voice-join-${channel.DepartmentVoiceChannelId}`}>
                      <ButtonIcon as={Phone} />
                      <ButtonText>{t('command.channel_join')}</ButtonText>
                    </Button>
                  )}
                </HStack>
              </HStack>
            );
          })}
        </VStack>
      )}

      {transmissionLog.length > 0 ? (
        <VStack space="xs" className="mt-3" testID="command-transmission-log">
          <Text className="text-2xs font-medium uppercase text-gray-500 dark:text-gray-400">{t('command.transmission_log')}</Text>
          {transmissionLog.slice(0, 10).map((log) => {
            const seconds = transmissionSeconds(log);
            const channelLabel = channels.find((c) => c.DepartmentVoiceChannelId === log.DepartmentVoiceChannelId)?.Name ?? '';
            return (
              <HStack key={log.VoiceTransmissionLogId} space="sm" className="items-center rounded-lg bg-gray-50 px-3 py-1.5 dark:bg-gray-900" testID={`transmission-${log.VoiceTransmissionLogId}`}>
                <Text className="w-20 shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatLogTime(log.StartedOn)}</Text>
                <Text className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{personName(log.UserId)}</Text>
                {channelLabel ? <Text className="text-xs text-gray-500 dark:text-gray-400">{channelLabel}</Text> : null}
                {seconds !== null ? <Text className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{t('command.transmission_seconds', { count: seconds })}</Text> : null}
              </HStack>
            );
          })}
        </VStack>
      ) : null}
    </Box>
  );
};
