import { CloudOff, Send, Server, Smartphone, Sparkles, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { incidentTypeName } from '@/services/incident-assistant';
import { buildAnswerContext, useIncidentAssistantStore } from '@/stores/command/assistant-store';
import { useOfflineQueueStore } from '@/stores/offline-queue/store';

interface IncidentAssistantSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The incident whose board the question is about. */
  callId: string;
}

/**
 * The command-board assistant. Questions are answered from the board cached on the device wherever
 * the deterministic matcher recognizes them — which is the point of it being here rather than in the
 * chat tab: a commander asking "PAR" on a scene with no coverage still gets an answer. Live weather
 * and free-form questions go to Resgrid Core, and each answer says which one it came from.
 */
export const IncidentAssistantSheet: React.FC<IncidentAssistantSheetProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');

  const messages = useIncidentAssistantStore((state) => state.messagesByCallId[callId]);
  const askingCallId = useIncidentAssistantStore((state) => state.askingCallId);
  const isConnected = useOfflineQueueStore((state) => state.isConnected);
  const isNetworkReachable = useOfflineQueueStore((state) => state.isNetworkReachable);

  const isAsking = askingCallId === callId;
  const isOffline = !isConnected || !isNetworkReachable;

  // The playbook (and therefore the chips and type badge) is derived from the board and the call, so
  // it recomputes whenever the sheet re-renders with new board data.
  const suggestions = useMemo(() => (isOpen ? useIncidentAssistantStore.getState().suggestions(callId) : []), [isOpen, callId]);
  const typeName = useMemo(() => (isOpen ? incidentTypeName(buildAnswerContext(callId)) : ''), [isOpen, callId]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isAsking) {
        return;
      }
      setQuestion('');
      void useIncidentAssistantStore.getState().ask(callId, trimmed, t);
    },
    [callId, isAsking, t]
  );

  const handleSend = useCallback(() => submit(question), [question, submit]);
  const handleClear = useCallback(() => useIncidentAssistantStore.getState().clear(callId), [callId]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]} testID="incident-assistant-sheet">
      <VStack space="md" className="w-full">
        <HStack className="items-center justify-between">
          <HStack space="sm" className="min-w-0 flex-1 items-center">
            <Box className="size-8 items-center justify-center rounded-full bg-purple-600">
              <Sparkles size={18} color="#ffffff" />
            </Box>
            <VStack className="min-w-0 flex-1">
              <Heading size="sm">{t('incident_assistant.title')}</Heading>
              {typeName ? <Text className="text-xs text-gray-500 dark:text-gray-400">{typeName}</Text> : null}
            </VStack>
          </HStack>
          <HStack space="xs" className="items-center">
            {isOffline ? (
              <Badge action="warning" size="sm" testID="incident-assistant-offline-badge">
                <BadgeText>{t('incident_assistant.offline_badge')}</BadgeText>
              </Badge>
            ) : null}
            {messages && messages.length > 0 ? (
              <Button variant="outline" size="xs" onPress={handleClear} accessibilityLabel={t('incident_assistant.clear')} testID="incident-assistant-clear">
                <ButtonIcon as={Trash2} />
              </Button>
            ) : null}
          </HStack>
        </HStack>

        {/* One-tap prompts, chosen for this incident's ICS type. The label is localized; the question
            sent to the matcher stays canonical English, matching the backend classifier. */}
        {suggestions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="incident-assistant-suggestions">
            <HStack space="sm">
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.question}
                  className="rounded-full bg-gray-200 px-4 py-3 dark:bg-gray-700"
                  onPress={() => submit(suggestion.question)}
                  testID={`incident-assistant-suggestion-${suggestion.question}`}
                >
                  <Text className="text-xs font-medium text-gray-800 dark:text-gray-100">{t(suggestion.labelKey)}</Text>
                </Pressable>
              ))}
            </HStack>
          </ScrollView>
        ) : null}

        {!messages || messages.length === 0 ? (
          <VStack space="xs" className="items-center py-6" testID="incident-assistant-empty">
            <Sparkles size={36} color="#9ca3af" />
            <Text className="text-center text-sm text-gray-500 dark:text-gray-400">{t('incident_assistant.empty')}</Text>
          </VStack>
        ) : (
          <VStack space="sm" testID="incident-assistant-messages">
            {messages.map((entry) =>
              entry.role === 'user' ? (
                <Box key={entry.id} className="self-end rounded-2xl rounded-br-sm bg-purple-600 px-3 py-2" testID={`incident-assistant-message-${entry.id}`}>
                  <Text className="text-sm text-white">{entry.text}</Text>
                </Box>
              ) : (
                <VStack
                  key={entry.id}
                  space="xs"
                  className={`self-start rounded-2xl rounded-bl-sm px-3 py-2 ${entry.isError ? 'bg-error-50' : 'bg-gray-100 dark:bg-gray-800'}`}
                  testID={`incident-assistant-message-${entry.id}`}
                >
                  <Text className="text-sm text-gray-900 dark:text-gray-100">{entry.text}</Text>
                  {entry.source ? (
                    <HStack space="xs" className="items-center">
                      <Icon as={entry.source === 'device' ? Smartphone : Server} size="xs" className="text-gray-400" />
                      <Text className="text-2xs text-gray-400">{entry.source === 'device' ? t('incident_assistant.source_device') : t('incident_assistant.source_server')}</Text>
                    </HStack>
                  ) : null}
                </VStack>
              )
            )}
          </VStack>
        )}

        {isAsking ? (
          <HStack space="sm" className="items-center" testID="incident-assistant-thinking">
            <Spinner size="small" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{t('incident_assistant.thinking')}</Text>
          </HStack>
        ) : null}

        <HStack space="sm" className="items-center">
          <Box className="flex-1">
            <Input className="rounded-2xl bg-gray-100 dark:bg-gray-800">
              <InputField placeholder={t('incident_assistant.placeholder')} value={question} onChangeText={setQuestion} onSubmitEditing={handleSend} returnKeyType="send" testID="incident-assistant-input" />
            </Input>
          </Box>
          <Pressable
            className={`rounded-full p-3 ${question.trim() && !isAsking ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}
            onPress={handleSend}
            disabled={!question.trim() || isAsking}
            accessibilityLabel={t('incident_assistant.send')}
            testID="incident-assistant-send"
          >
            <Send size={18} color="#ffffff" />
          </Pressable>
        </HStack>

        {isOffline ? (
          <HStack space="xs" className="items-center">
            <Icon as={CloudOff} size="xs" className="text-amber-500" />
            <Text className="text-2xs text-gray-500 dark:text-gray-400">{t('incident_assistant.offline_hint')}</Text>
          </HStack>
        ) : null}
      </VStack>
    </CustomBottomSheet>
  );
};

export default IncidentAssistantSheet;
