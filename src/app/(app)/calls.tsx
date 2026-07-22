import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { PlusIcon, RefreshCcwDotIcon, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { getCommandForCall } from '@/api/incidentCommand/incidentCommand';
import { CallCard } from '@/components/calls/call-card';
import { ReopenCommandSheet } from '@/components/command/reopen-command-sheet';
import { StartCommandSheet } from '@/components/command/start-command-sheet';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Fab, FabIcon } from '@/components/ui/fab';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { useAnalytics } from '@/hooks/use-analytics';
import { logger } from '@/lib/logging';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type IncidentCommand } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useCallsStore } from '@/stores/calls/store';
import { useCommandStore } from '@/stores/command/store';
import { securityStore } from '@/stores/security/store';
import { useToastStore } from '@/stores/toast/store';

export default function Calls() {
  const calls = useCallsStore((state) => state.calls);
  const isLoading = useCallsStore((state) => state.isLoading);
  const error = useCallsStore((state) => state.error);
  const fetchCalls = useCallsStore((state) => state.fetchCalls);
  const fetchCallPriorities = useCallsStore((state) => state.fetchCallPriorities);
  const fetchCallDispatches = useCallsStore((state) => state.fetchCallDispatches);
  const callDispatches = useCallsStore((state) => state.callDispatches);
  const canUserCreateCalls = securityStore((state) => state.rights?.CanCreateCalls);
  const commandBoards = useCommandStore((state) => state.boards);
  const activeBoardCallId = useCommandStore((state) => state.activeCallId);
  const showToast = useToastStore((state) => state.showToast);
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [searchQuery, setSearchQuery] = useState('');
  const [templatePickerCall, setTemplatePickerCall] = useState<CallResultData | null>(null);
  /** A prior ENDED command exists for this call — ask whether to reopen it before starting a new one. */
  const [reopenPrompt, setReopenPrompt] = useState<{ call: CallResultData; priorCommand: IncidentCommand } | null>(null);

  const startCommandForCall = useCallback(
    async (call: CallResultData, commandDefinitionId: number | null) => {
      try {
        await useCommandStore.getState().startCommand(call.CallId, commandDefinitionId);
        showToast('success', t('command.start_success'));
        router.push('/command');
      } catch (error) {
        logger.error({
          message: 'Failed to start command for call',
          context: { error, callId: call.CallId },
        });
        showToast('error', t('command.start_error'));
      }
    },
    [showToast, t]
  );

  // Opens an existing board directly; otherwise checks for a prior ENDED command on the call
  // (offering to reopen it) before falling back to the template picker for a brand-new command.
  const handleStartCommand = useCallback(
    async (call: CallResultData) => {
      if (useCommandStore.getState().boards[call.CallId]) {
        startCommandForCall(call, null);
        return;
      }
      try {
        const prior = await getCommandForCall(call.CallId);
        if (prior?.Data && prior.Data.Status !== 0) {
          setReopenPrompt({ call, priorCommand: prior.Data });
          return;
        }
      } catch {
        // No prior command / lookup failed — fall through to a new command.
      }
      setTemplatePickerCall(call);
    },
    [startCommandForCall]
  );

  const handleCloseReopenPrompt = useCallback(() => setReopenPrompt(null), []);

  // Fall through from the reopen prompt to a brand-new command via the template picker.
  const handleStartNewFromReopen = useCallback(() => {
    const call = reopenPrompt?.call ?? null;
    setReopenPrompt(null);
    if (call) {
      setTemplatePickerCall(call);
    }
  }, [reopenPrompt]);

  const handleCloseTemplatePicker = useCallback(() => setTemplatePickerCall(null), []);

  const handleTemplatePicked = useCallback(
    (commandDefinitionId: number | null) => {
      if (templatePickerCall) {
        startCommandForCall(templatePickerCall, commandDefinitionId);
      }
    },
    [templatePickerCall, startCommandForCall]
  );

  const handleReopenCommand = useCallback(
    async (reason: string) => {
      if (!reopenPrompt) {
        return;
      }
      const { call, priorCommand } = reopenPrompt;
      setReopenPrompt(null);
      const ok = await useCommandStore.getState().reopenCommandForCall(call.CallId, priorCommand.IncidentCommandId, reason || null);
      showToast(ok ? 'success' : 'error', ok ? t('command.reopen_success') : t('command.reopen_error'));
      if (ok) {
        router.push('/command');
      }
    },
    [reopenPrompt, showToast, t]
  );

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCallPriorities();
      fetchCalls();

      return () => {
        // Clean up if needed when screen loses focus
      };
    }, [fetchCalls, fetchCallPriorities])
  );

  // Fetch dispatch data for all active calls after calls load (cached per callId)
  useEffect(() => {
    if (calls.length > 0) {
      const callIds = calls.map((c) => c.CallId);
      fetchCallDispatches(callIds);
    }
  }, [calls, fetchCallDispatches]);

  // Track when calls view is rendered
  useEffect(() => {
    trackEvent('calls_view_rendered', {
      callsCount: calls.length,
      hasSearchQuery: searchQuery.length > 0,
    });
  }, [trackEvent, calls.length, searchQuery]);

  const handleRefresh = () => {
    fetchCalls();
    fetchCallPriorities();
    // Dispatches will auto-fetch via useEffect when calls update
  };

  const handleNewCall = () => {
    router.push('/call/new/');
  };

  // Filter calls based on search query
  const filteredCalls = calls.filter((call) => call.CallId.toLowerCase().includes(searchQuery.toLowerCase()) || (call.Nature?.toLowerCase() || '').includes(searchQuery.toLowerCase()));

  // Render content based on loading, error, and data states
  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('calls.loading')} />;
    }

    // Only surface a fetch error when there is no cached data to show —
    // offline the list keeps rendering the last synced calls.
    if (error && filteredCalls.length === 0) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <FlatList<CallResultData>
        testID="calls-list"
        data={filteredCalls}
        renderItem={({ item }: { item: CallResultData }) => (
          <Pressable onPress={() => router.push(`/call/${item.CallId}`)}>
            <CallCard
              call={item}
              priority={useCallsStore.getState().callPriorities.find((p: { Id: number }) => p.Id === item.Priority)}
              dispatches={callDispatches[item.CallId]}
              isCommandCall={item.CallId === activeBoardCallId}
              hasCommand={!!commandBoards[item.CallId]}
              onStartCommand={() => handleStartCommand(item)}
            />
          </Pressable>
        )}
        keyExtractor={(item: CallResultData) => item.CallId}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        ListEmptyComponent={<ZeroState heading={t('calls.no_calls')} description={t('calls.no_calls_description')} icon={RefreshCcwDotIcon} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/* Search input */}
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('calls.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {/* Main content */}
        <Box className="flex-1">{renderContent()}</Box>

        {/* Prior ended command found — reopen it (with a reason) or start fresh */}
        <ReopenCommandSheet isOpen={reopenPrompt !== null} onClose={handleCloseReopenPrompt} priorCommand={reopenPrompt?.priorCommand ?? null} onReopen={handleReopenCommand} onStartNew={handleStartNewFromReopen} />

        {/* Command template picker for starting a new board */}
        <StartCommandSheet isOpen={templatePickerCall !== null} onClose={handleCloseTemplatePicker} onStart={handleTemplatePicked} />

        {/* FAB button for creating new call - only show if user has permission */}
        {canUserCreateCalls ? (
          <Fab size="lg" onPress={handleNewCall} testID="new-call-fab">
            <FabIcon as={PlusIcon} size="lg" />
          </Fab>
        ) : null}
      </Box>
    </View>
  );
}
