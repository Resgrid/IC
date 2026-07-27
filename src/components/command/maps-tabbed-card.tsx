import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IncidentMapCard } from '@/components/command/incident-map-card';
import { IncidentMapsSection } from '@/components/command/incident-maps-section';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { type IncidentCommand, type IncidentMap, type IncidentMapAnnotation } from '@/models/v4/incidentCommand/incidentCommandModels';

type MapsTab = 'incident' | 'tactical';

interface MapsTabbedCardProps {
  callId: string;
  command: IncidentCommand;
  annotations: IncidentMapAnnotation[];
  maps: IncidentMap[];
  onCreateMap: (name: string, description: string | null, expiresOn: string | null) => void;
  onDeleteMap: (incidentMapId: string) => void;
  resolveUserName?: (userId: string) => string;
}

/**
 * Single command-board pane hosting both map surfaces: the incident tactical map (default tab)
 * and the named tactical maps list. Tabs switch the body; each child renders embedded (no own card).
 */
export const MapsTabbedCard: React.FC<MapsTabbedCardProps> = ({ callId, command, annotations, maps, onCreateMap, onDeleteMap, resolveUserName }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MapsTab>('incident');

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-maps-pane">
      <HStack space="sm" className="mb-3">
        <Button size="xs" variant={tab === 'incident' ? 'solid' : 'outline'} onPress={() => setTab('incident')} testID="maps-tab-incident">
          <ButtonText>{t('command.incident_map_section')}</ButtonText>
        </Button>
        <Button size="xs" variant={tab === 'tactical' ? 'solid' : 'outline'} onPress={() => setTab('tactical')} testID="maps-tab-tactical">
          <ButtonText>{`${t('command.incident_maps_section')} (${maps.length})`}</ButtonText>
        </Button>
      </HStack>

      {tab === 'incident' ? (
        <IncidentMapCard embedded callId={callId} command={command} annotations={annotations} />
      ) : (
        <IncidentMapsSection embedded callId={callId} maps={maps} onCreate={onCreateMap} onDelete={onDeleteMap} resolveUserName={resolveUserName} />
      )}
    </Box>
  );
};
