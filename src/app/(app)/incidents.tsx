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
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { type IncidentCommandSummary } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useIncidentsStore } from '@/stores/command/incidents-store';

export default function Incidents() {
  const { t } = useTranslation();
  const summaries = useIncidentsStore((state) => state.summaries);
  const includeClosed = useIncidentsStore((state) => state.includeClosed);
  const isLoading = useIncidentsStore((state) => state.isLoading);
  const error = useIncidentsStore((state) => state.error);
  const fetchIncidents = useIncidentsStore((state) => state.fetchIncidents);
  const setIncludeClosed = useIncidentsStore((state) => state.setIncludeClosed);

  useFocusEffect(
    useCallback(() => {
      fetchIncidents();
    }, [fetchIncidents])
  );

  const handleOpen = useCallback((summary: IncidentCommandSummary) => {
    // Ended incidents open the read-only history view for that SPECIFIC command instance.
    if (summary.Status !== 0) {
      router.push(`/incident/${summary.CallId}?commandId=${encodeURIComponent(summary.IncidentCommandId)}` as never);
    } else {
      router.push(`/incident/${summary.CallId}` as never);
    }
  }, []);

  const renderContent = () => {
    if (isLoading && summaries.length === 0) {
      return <Loading text={t('incidents.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <FlatList<IncidentCommandSummary>
        testID="incidents-list"
        data={summaries}
        keyExtractor={(item: IncidentCommandSummary) => item.IncidentCommandId}
        renderItem={({ item }: { item: IncidentCommandSummary }) => <IncidentCard summary={item} onPress={() => handleOpen(item)} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetchIncidents} />}
        ListEmptyComponent={<ZeroState heading={t('incidents.no_incidents')} description={t('incidents.no_incidents_description')} icon={LayoutDashboard} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-2">
        {/* Active-only by default; the second chip adds ended incidents (read-only history) */}
        <HStack space="sm" className="mb-3" testID="incidents-filter">
          <Pressable onPress={() => setIncludeClosed(false)} className={`rounded-full px-4 py-2 ${!includeClosed ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} testID="incidents-filter-active">
            <Text className={`text-sm font-semibold ${!includeClosed ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{t('incidents.filter_active')}</Text>
          </Pressable>
          <Pressable onPress={() => setIncludeClosed(true)} className={`rounded-full px-4 py-2 ${includeClosed ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} testID="incidents-filter-all">
            <Text className={`text-sm font-semibold ${includeClosed ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{t('incidents.filter_all')}</Text>
          </Pressable>
        </HStack>
        {renderContent()}
      </Box>
    </View>
  );
}
