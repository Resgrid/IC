import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { getReadinessPacket } from '@/api/checklists/readiness';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type ReadinessPacket, summarizeReadiness } from '@/lib/checklists/readiness';

interface UnitReadinessPanelProps {
  callId: number;
}

// Readiness of the units committed to the incident, from their apparatus checks and work orders over the
// 30 days before the call: a failed or missed check, or an open high-priority work order, puts a unit on top.
// Read-only; the evidence packet itself stays on the web.
export const UnitReadinessPanel: React.FC<UnitReadinessPanelProps> = ({ callId }) => {
  const { t } = useTranslation();
  const [packet, setPacket] = useState<ReadinessPacket | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPacket(await getReadinessPacket(callId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    void load();
  }, [load]);

  const units = useMemo(() => (packet ? summarizeReadiness(packet, t('readiness.unnamedUnit')) : []), [packet, t]);

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} testID="unit-readiness-panel">
      {loading ? <Spinner /> : null}
      {failed ? (
        <VStack space="sm">
          <Text className="text-typography-500">{t('readiness.unavailable')}</Text>
          <Button variant="outline" size="sm" onPress={() => void load()} testID="unit-readiness-retry">
            <ButtonText>{t('readiness.retry')}</ButtonText>
          </Button>
        </VStack>
      ) : null}
      {packet && units.length === 0 ? <Text className="text-typography-500">{t('readiness.noUnits')}</Text> : null}
      {packet ? <Text className="text-typography-500">{t('readiness.window', { from: packet.CoverageStartUtc.slice(0, 10), to: packet.CoverageEndUtc.slice(0, 10) })}</Text> : null}
      {units.map((unit) => (
        <VStack key={unit.unitId} space="xs" className={`rounded-lg border p-3 ${unit.attention ? 'border-warning-500' : 'border-outline-200'}`} testID={`unit-readiness-${unit.unitId}`}>
          <HStack className="items-center justify-between">
            <Text className="flex-1 font-semibold">{unit.name}</Text>
            <Text className={unit.attention ? 'text-warning-600' : 'text-success-600'}>{unit.attention ? t('readiness.attention') : t('readiness.ready')}</Text>
          </HStack>
          <Text className="text-typography-500">
            {unit.latest
              ? t(unit.latest.Passed === false ? 'readiness.latestFailed' : 'readiness.latestPassed', { name: unit.latest.Name ?? '', when: String(unit.latest.SubmittedUtc).slice(0, 16).replace('T', ' ') })
              : t('readiness.noChecks')}
          </Text>
          {unit.failed > 0 || unit.missed > 0 ? <Text className="text-warning-600">{t('readiness.problems', { failed: unit.failed, missed: unit.missed })}</Text> : null}
          {unit.openWorkOrders.map((order) => (
            <Text key={order.WorkOrderId} className="text-typography-600">
              {t('readiness.openWorkOrder', { title: order.Title ?? '' })}
            </Text>
          ))}
        </VStack>
      ))}
      {packet && packet.UnavailableSources.includes('RestrictedUnits') ? <Text className="text-typography-500">{t('readiness.restricted')}</Text> : null}
    </ScrollView>
  );
};
