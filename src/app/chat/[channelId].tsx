import { Image } from 'expo-image';
import { type Href, Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ArrowLeft, Circle, ShieldCheck } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';

import { getPresence, uploadAttachment } from '@/api/chat/chat';
import { AckBanner } from '@/components/chat/ack-banner';
import { buildGifMetadata, buildLocationMetadata, copyToClipboard, getChannelDisplayName, getImageMimeType } from '@/components/chat/chat-utils';
import { GifPickerSheet } from '@/components/chat/gif-picker-sheet';
import { MessageActionsSheet } from '@/components/chat/message-actions-sheet';
import { MessageBubble } from '@/components/chat/message-bubble';
import { MessageComposer } from '@/components/chat/message-composer';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { BottomAnchoredKeyboardView } from '@/components/ui/keyboard-avoiding-view';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { ChatChannelType, ChatMessagePriority, type ChatMessageResultData, ChatMessageType, type GifResultData } from '@/models/v4/chat';
import useAuthStore from '@/stores/auth/store';
import { useChatStore } from '@/stores/chat/store';
import { useChatSystemStatus } from '@/stores/feature-flags/store';
import { securityStore } from '@/stores/security/store';
import { useToastStore } from '@/stores/toast/store';

/** Command-type channels (Incident / IncidentLane / IncidentCommand / IncidentLeads /
 * IncidentDispatch) where the user posts as the Incident Commander rather than as themselves. */
function isCommandChannelType(channelType?: number): boolean {
  return (
    channelType === ChatChannelType.Incident ||
    channelType === ChatChannelType.IncidentLane ||
    channelType === ChatChannelType.IncidentCommand ||
    channelType === ChatChannelType.IncidentLeads ||
    channelType === ChatChannelType.IncidentDispatch
  );
}

export default function ChannelConversationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ channelId: string }>();
  const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

  const currentUserId = useAuthStore((s) => s.userId);
  const isModerator = !!securityStore((s) => s.rights)?.IsAdmin;
  const chatStatus = useChatSystemStatus();
  const isChatEnabled = chatStatus === 'enabled';

  const channel = useChatStore((s) => s.channels.find((c) => c.ChatChannelId === channelId));
  const messages = useChatStore((s) => (channelId ? s.messagesByChannel[channelId] : undefined));
  const typing = useChatStore((s) => (channelId ? s.typingByChannel[channelId] : undefined));
  const members = useChatStore((s) => (channelId ? s.membersByChannel[channelId] : undefined));
  const presence = useChatStore((s) => s.presence);
  const pendingAcks = useChatStore((s) => s.pendingAcks);
  const loading = useChatStore((s) => (channelId ? s.loadingMessagesByChannel[channelId] : false));

  const [gifOpen, setGifOpen] = useState(false);
  const [actionsMessage, setActionsMessage] = useState<ChatMessageResultData | null>(null);
  const [editMessage, setEditMessage] = useState<ChatMessageResultData | null>(null);
  const [editText, setEditText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [presenceIds, setPresenceIds] = useState<Set<string>>(new Set());
  const [resolveAttempted, setResolveAttempted] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isDm = channel?.ChannelType === ChatChannelType.DirectMessage;
  const isChatbot = channel?.ChannelType === ChatChannelType.Chatbot;
  // Deep links (push notifications, cold starts) can arrive before the channel
  // list loads; the channel type is unknown until then. Treat a completed fetch
  // with no match as resolved so unknown channels keep the generic screen.
  const isResolved = !!channel || resolveAttempted;
  const showSender = !isDm;
  // IC delta: in command-type channels the user posts as the Incident Commander.
  // The server validates the user actually holds command (CanSendAsIcAsync) and rejects otherwise.
  const isCommandChannel = isCommandChannelType(channel?.ChannelType);

  /**
   * Archived channel = point-in-time record. A closed incident freezes its command and lane chat, and
   * a closed call freezes its incident chat: no posting, no editing, no reactions. The server enforces
   * all of it; this just stops the UI offering actions that would bounce. Flagging stays available.
   */
  const isFrozen = !!channel?.IsArchived;

  /**
   * Back always lands on the chat list. router.back() alone is not enough — this screen is routinely
   * entered from a push notification or a deep link with no history to pop, which leaves the default
   * header back button absent entirely.
   */
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/chat' as Href);
  }, [router]);

  const headerLeftBack = useCallback(
    () => (
      <Pressable className="p-3" hitSlop={8} onPress={handleBack} accessibilityLabel={t('common.back')} testID="chat-detail-back">
        <Icon as={ArrowLeft} size={24} className="text-gray-700 dark:text-gray-200" />
      </Pressable>
    ),
    [handleBack, t]
  );

  // Newest-first for the inverted list.
  const inverted = useMemo(() => (messages ? messages.slice().reverse() : []), [messages]);

  // Resolve the channel identity for deep links before mounting the generic view.
  useEffect(() => {
    if (channel || resolveAttempted || !isChatEnabled) return;
    void useChatStore
      .getState()
      .fetchChannels()
      .finally(() => setResolveAttempted(true));
  }, [channel, resolveAttempted, isChatEnabled]);

  // Mount: activate channel, join hub, load history and members. Assistant
  // conversations are handled by the dedicated chatbot screen — never join or
  // load them here, and wait for unresolved deep links to identify first.
  useFocusEffect(
    useCallback(() => {
      if (!channelId || !isChatEnabled || !isResolved || isChatbot) return;
      const store = useChatStore.getState();
      store.setActiveChannel(channelId);
      void store.joinChannel(channelId);
      void store.loadInitialMessages(channelId);
      void store.fetchMembers(channelId);
      return () => {
        useChatStore.getState().setActiveChannel(null);
      };
    }, [channelId, isChatEnabled, isResolved, isChatbot])
  );

  // Fetch presence for the channel members (for the header online dot).
  useEffect(() => {
    if (!isChatEnabled) return;
    const ids = (members ?? []).map((m) => m.UserId).filter((id): id is string => !!id && id !== currentUserId);
    if (ids.length === 0) return;
    const controller = new AbortController();
    getPresence(ids, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setPresenceIds(new Set(result.OnlineUserIds ?? []));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [members, currentUserId, isChatEnabled]);

  // Mark read whenever the newest message changes while viewing.
  useEffect(() => {
    if (!isChatEnabled) return;
    if (channelId && isResolved && !isChatbot && inverted.length > 0) {
      void useChatStore.getState().markChannelRead(channelId);
    }
  }, [channelId, inverted.length, isChatEnabled, isResolved, isChatbot]);

  const otherOnline = useMemo(() => {
    if (!isDm) return false;
    const other = (members ?? []).find((m) => m.UserId && m.UserId !== currentUserId);
    if (!other?.UserId) return false;
    return presence.has(other.UserId) || presenceIds.has(other.UserId);
  }, [isDm, members, currentUserId, presence, presenceIds]);

  const channelAcks = useMemo(() => pendingAcks.filter((a) => a.ChatChannelId === channelId), [pendingAcks, channelId]);

  useEffect(
    () => () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    },
    [channelId]
  );

  const typingNames = useMemo(() => {
    const now = Date.now();
    return (typing ?? []).filter((u) => u.expiresAt > now).map((u) => u.displayName || t('chat.someone'));
  }, [typing, t]);

  // ---- send handlers ----
  const handleSendText = useCallback(
    (body: string, urgent: boolean) => {
      if (!channelId) return;
      void useChatStore.getState().sendMessage({ channelId, body, priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal, asIncidentCommander: isCommandChannel });
    },
    [channelId, isCommandChannel]
  );

  const handleSendGif = useCallback(
    (gif: GifResultData) => {
      if (!channelId) return;
      const metadata = buildGifMetadata(gif);
      void useChatStore.getState().sendMessage({ channelId, body: gif.Title ?? 'GIF', messageType: ChatMessageType.Gif, metadataJson: metadata, asIncidentCommander: isCommandChannel });
    },
    [channelId, isCommandChannel]
  );

  const handleSendLocation = useCallback(
    (latitude: number, longitude: number, urgent: boolean) => {
      if (!channelId) return;
      const metadata = buildLocationMetadata(latitude, longitude);
      void useChatStore.getState().sendMessage({
        channelId,
        body: t('chat.shared_location'),
        messageType: ChatMessageType.Location,
        metadataJson: metadata,
        priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal,
        asIncidentCommander: isCommandChannel,
      });
    },
    [channelId, t, isCommandChannel]
  );

  // Image send: optimistic bubble, then upload the file once the queued message
  // is reconciled and receives its server ChatMessageId (initial send, retry, or outbox drain).
  const handleSendImage = useCallback(
    (uri: string, urgent: boolean, mimeType?: string) => {
      if (!channelId) return;
      const name = uri.split('/').pop() || `photo-${Date.now()}.jpg`;
      const type = getImageMimeType(uri, mimeType);

      const unsubscribe = useChatStore.subscribe((state) => {
        const sent = (state.messagesByChannel[channelId] ?? []).find((m) => m._localAttachmentUri === uri);
        if (!sent) return;
        if (sent._localStatus === 'failed') {
          const retryable = state.outbox.some((item) => item.ClientMessageId === sent.ClientMessageId);
          if (retryable) return;
          unsubscribe();
          if (unsubscribeRef.current === unsubscribe) unsubscribeRef.current = null;
          return;
        }
        if (sent.ChatMessageId.startsWith('local-')) return;
        unsubscribe();
        if (unsubscribeRef.current === unsubscribe) unsubscribeRef.current = null;
        void (async () => {
          try {
            await uploadAttachment(channelId, sent.ChatMessageId, { uri, name, type });
          } catch {
            useToastStore.getState().showToast('error', t('chat.attachment_failed'));
          }
        })();
      });
      unsubscribeRef.current = unsubscribe;

      void useChatStore.getState().sendMessage({
        channelId,
        body: '',
        messageType: ChatMessageType.Image,
        priority: urgent ? ChatMessagePriority.Urgent : ChatMessagePriority.Normal,
        localAttachmentUri: uri,
        asIncidentCommander: isCommandChannel,
      });
    },
    [channelId, t, isCommandChannel]
  );

  const handleToggleReaction = useCallback(
    (message: ChatMessageResultData, emoji: string, mine: boolean) => {
      if (!channelId || isFrozen) return;
      if (mine) void useChatStore.getState().removeReaction(message.ChatMessageId, channelId, emoji);
      else void useChatStore.getState().addReaction(message.ChatMessageId, channelId, emoji);
    },
    [channelId, isFrozen]
  );

  /**
   * The actions sheet already hides Edit on a frozen channel, but a channel can freeze while the edit
   * sheet is open — the incident closes and SignalR flips IsArchived under it. Drop the in-progress
   * edit rather than leave a sheet whose save the server would reject.
   */
  useEffect(() => {
    if (isFrozen && editMessage) {
      setEditMessage(null);
      setEditText('');
      useToastStore.getState().showToast('info', t('chat.frozen_notice'));
    }
  }, [isFrozen, editMessage, t]);

  const handleSaveEdit = useCallback(() => {
    // Guards the race between the freeze landing and this press.
    if (isFrozen) {
      setEditMessage(null);
      setEditText('');
      return;
    }
    if (editMessage && channelId && editText.trim()) {
      void useChatStore.getState().editMessage(editMessage.ChatMessageId, channelId, editText.trim());
    }
    setEditMessage(null);
  }, [isFrozen, editMessage, channelId, editText]);

  const openThread = useCallback(
    (message: ChatMessageResultData) => {
      router.push(`/chat/thread/${message.ChatMessageId}?channelId=${channelId ?? ''}` as Href);
    },
    [router, channelId]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageResultData }) => (
      <MessageBubble
        message={item}
        isOwn={!!item.SenderUserId && item.SenderUserId === currentUserId}
        showSender={showSender}
        currentUserId={currentUserId}
        onLongPress={setActionsMessage}
        onToggleReaction={handleToggleReaction}
        onOpenThread={openThread}
        onRetry={(m) => m.ClientMessageId && useChatStore.getState().retryOutboxItem(m.ClientMessageId)}
        onPressImage={setImageUri}
      />
    ),
    [currentUserId, showSender, handleToggleReaction, openThread]
  );

  const keyExtractor = useCallback((item: ChatMessageResultData) => item.ChatMessageId, []);

  const handleEndReached = useCallback(() => {
    if (channelId) void useChatStore.getState().loadOlderMessages(channelId);
  }, [channelId]);

  const title = channel ? getChannelDisplayName(channel, t) : t('chat.title');

  // Chat.System flag not yet resolved: wait instead of redirecting away from a valid deep link.
  if (chatStatus === 'unknown') {
    return (
      <Box className="size-full flex-1 items-center justify-center bg-background-0">
        <Stack.Screen options={{ title, headerShown: true, headerBackTitle: '', headerLeft: headerLeftBack }} />
        <Spinner />
      </Box>
    );
  }

  // Chat.System feature flag off: block deep links (push notifications, stale routes).
  if (chatStatus === 'disabled') {
    return <Redirect href="/" />;
  }

  // Deep link to a channel that isn't loaded yet: wait for the channel list so
  // assistant conversations never mount the full-featured view.
  if (!isResolved) {
    return (
      <Box className="size-full flex-1 items-center justify-center bg-background-0">
        <Stack.Screen options={{ title, headerShown: true, headerBackTitle: '', headerLeft: headerLeftBack }} />
        <Spinner />
      </Box>
    );
  }

  // Assistant conversations always use the dedicated restricted screen (text only,
  // no reactions/threads/deletes) — catch deep links and stale routes here.
  if (isChatbot) {
    return <Redirect href={'/chatbot' as Href} />;
  }

  return (
    <Box className="size-full flex-1 bg-background-0">
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          headerBackTitle: '',
          headerLeft: headerLeftBack,
          headerRight: () => (isDm ? <Circle size={12} color={otherOnline ? '#22c55e' : '#9ca3af'} fill={otherOnline ? '#22c55e' : '#9ca3af'} /> : undefined),
        }}
      />

      {isFrozen ? (
        <HStack className="items-center border-b border-outline-100 bg-gray-100 px-4 py-2 dark:bg-gray-800" space="xs" testID="chat-frozen-banner">
          <Icon as={Archive} size={14} className="text-gray-600 dark:text-gray-300" />
          <Text className="flex-1 text-xs text-gray-700 dark:text-gray-200">{t('chat.frozen_notice')}</Text>
        </HStack>
      ) : null}

      {/* IC delta: identity chip — messages in command channels post as the Incident Commander. */}
      {isCommandChannel ? (
        <HStack className="items-center border-b border-outline-100 bg-primary-50 px-4 py-1.5 dark:bg-primary-950" space="xs">
          <ShieldCheck size={14} color="#2563eb" />
          <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">{t('chat.chatting_as_ic')}</Text>
        </HStack>
      ) : null}

      <AckBanner acks={channelAcks} onAcknowledge={(messageId) => useChatStore.getState().acknowledgeMessage(messageId)} />

      <BottomAnchoredKeyboardView>
        {loading && inverted.length === 0 ? (
          <Center className="flex-1">
            <Spinner />
          </Center>
        ) : (
          <FlatList
            data={inverted}
            inverted
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            removeClippedSubviews
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}

        <TypingIndicator names={typingNames} />

        <MessageComposer
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendLocation={handleSendLocation}
          onOpenGif={() => setGifOpen(true)}
          onTyping={(isTyping) => channelId && useChatStore.getState().sendTyping(channelId, isTyping)}
          disabled={isFrozen || (channel?.IsLocked && !isModerator)}
        />
      </BottomAnchoredKeyboardView>

      <GifPickerSheet isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleSendGif} />

      <MessageActionsSheet
        message={actionsMessage}
        isOpen={actionsMessage !== null}
        onClose={() => setActionsMessage(null)}
        isOwn={!!actionsMessage?.SenderUserId && actionsMessage.SenderUserId === currentUserId}
        isModerator={isModerator}
        frozen={isFrozen}
        onReact={(m, emoji) =>
          handleToggleReaction(
            m,
            emoji,
            (m.Reactions ?? []).some((r) => r.Emoji === emoji && r.UserId === currentUserId)
          )
        }
        onReply={openThread}
        onCopy={async (m) => {
          const ok = await copyToClipboard(m.Body ?? '');
          useToastStore.getState().showToast(ok ? 'success' : 'info', ok ? t('chat.copied') : t('chat.copy_unavailable'));
        }}
        onEdit={(m) => {
          setEditMessage(m);
          setEditText(m.Body ?? '');
        }}
        onDelete={(m) => channelId && useChatStore.getState().deleteMessage(m.ChatMessageId, channelId)}
        onFlag={(m, reason) => useChatStore.getState().flagMessage(m.ChatMessageId, reason)}
        onTogglePin={(m, pinned) => channelId && useChatStore.getState().togglePin(m.ChatMessageId, channelId, pinned)}
        onModeratorDelete={(m) => channelId && useChatStore.getState().moderatorDeleteMessage(m.ChatMessageId, channelId, t('chat.moderator_removed'))}
      />

      {/* Edit message sheet */}
      <Actionsheet isOpen={editMessage !== null && !isFrozen} onClose={() => setEditMessage(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full p-2" space="md">
            <Text className="text-base font-semibold text-typography-900">{t('chat.edit_message')}</Text>
            <Textarea>
              <TextareaInput value={editText} onChangeText={setEditText} multiline />
            </Textarea>
            <Button className="bg-primary-600" isDisabled={isFrozen} onPress={handleSaveEdit} testID="chat-edit-save">
              <ButtonText>{t('chat.save')}</ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {/* Full-screen image preview */}
      <Actionsheet isOpen={imageUri !== null} onClose={() => setImageUri(null)} snapPoints={[80]}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          {imageUri ? (
            <Center className="w-full p-2">
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: 400, borderRadius: 12 }} contentFit="contain" />
            </Center>
          ) : null}
        </ActionsheetContent>
      </Actionsheet>
    </Box>
  );
}
