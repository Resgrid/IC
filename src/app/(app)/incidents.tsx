import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { LayoutDashboard } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { IncidentCard } from '@/components/command/incident-card';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { type IncidentCommandBoard } from '@/models/v4/incidentCommand/incidentCommandBoard';
import { useCallsStore } from '@/stores/calls/store';
import { useIncidentsStore } from '@/stores/command/incidents-store';

export default function Incidents() {
  const { t } = useTranslation();
  const incidents = useIncidentsStore((state) => state.incidents);
  const isLoading = useIncidentsStore((state) => state.isLoading);
  const error = useIncidentsStore((state) => state.error);
  const fetchActiveIncidents = useIncidentsStore((state) => state.fetchActiveIncidents);
  const calls = useCallsStore((state) => state.calls);
  const fetchCalls = useCallsStore((state) => state.fetchCalls);

  useFocusEffect(
    useCallback(() => {
      fetchActiveIncidents();
      fetchCalls();
    }, [fetchActiveIncidents, fetchCalls])
  );

  // Active commands carry only a numeric CallId; join the calls store (string CallId) for a human title.
  const callTitle = useCallback(
    (callId: number) => {
      const call = calls.find((c) => c.CallId === String(callId));
      return call?.Name || call?.Nature || t('incidents.unnamed');
    },
    [calls, t]
  );

  const renderContent = () => {
    if (isLoading && incidents.length === 0) {
      return <Loading text={t('incidents.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <FlatList<IncidentCommandBoard>
        testID="incidents-list"
        data={incidents}
        keyExtractor={(item: IncidentCommandBoard) => item.Command.IncidentCommandId}
        renderItem={({ item }: { item: IncidentCommandBoard }) => <IncidentCard board={item} title={callTitle(item.Command.CallId)} onPress={() => router.push(`/incident/${item.Command.CallId}` as never)} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetchActiveIncidents} />}
        ListEmptyComponent={<ZeroState heading={t('incidents.no_incidents')} description={t('incidents.no_incidents_description')} icon={LayoutDashboard} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">{renderContent()}</Box>
    </View>
  );
}
