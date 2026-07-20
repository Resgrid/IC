import { CloudOff, MapPin, Trash2, Truck } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { isWeb } from '@/lib/platform';
import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { ActiveUnitRoleResultData } from '@/models/v4/unitRoles/activeUnitRoleResultData';
import type { UnitResultData } from '@/models/v4/units/unitResultData';
import type { UnitStatusResultData } from '@/models/v4/unitStatus/unitStatusResultData';

/** Server status colors arrive as hex ('#3498db') or legacy css labels — only trust hex. */
const asHexColor = (value?: string | null) => (value && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()) ? value.trim() : undefined);

/** One-line truncation: numberOfLines leaks to the DOM through the styling pipeline on web, so use CSS ellipsis there. */
const oneLine = isWeb ? ({ isTruncated: true } as const) : ({ numberOfLines: 1 } as const);

const ServerColorBadge: React.FC<{ label: string; color?: string | null; testID?: string }> = ({ label, color, testID }) => {
  const hex = asHexColor(color);
  return (
    <Badge style={hex ? { backgroundColor: hex } : styles.badgeFallback} variant="solid" testID={testID}>
      <BadgeText className="text-white">{label}</BadgeText>
    </Badge>
  );
};

const LaneBadge: React.FC<{ label: string }> = ({ label }) => (
  <Badge action="muted" variant="outline">
    <BadgeText>{label}</BadgeText>
  </Badge>
);

interface CardShellProps {
  isLocal: boolean;
  onRelease: () => void;
  testID: string;
  removeTestID: string;
  children: React.ReactNode;
}

/** Shared card chrome: rounded container + offline marker + release button. */
const CardShell: React.FC<CardShellProps> = ({ isLocal, onRelease, testID, removeTestID, children }) => {
  const { t } = useTranslation();
  return (
    <HStack className="items-start justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900" space="sm" testID={testID}>
      <VStack className="min-w-0 flex-1" space="xs">
        {children}
      </VStack>
      <HStack className="items-center" space="xs">
        {isLocal ? <CloudOff className="text-amber-500" size={16} /> : null}
        <Pressable accessibilityLabel={t('common.remove')} accessibilityRole="button" className="p-1" onPress={onRelease} testID={removeTestID}>
          <Trash2 className="text-gray-400" size={16} />
        </Pressable>
      </HStack>
    </HStack>
  );
};

interface UnitResourceCardProps {
  /** Display name (falls back to the raw resource id upstream). */
  name: string;
  unit?: UnitResultData;
  /** Live status snapshot for this unit, when loaded. */
  status?: UnitStatusResultData;
  /** This unit's role seats with their current assignees (FullName empty = open). */
  roles: ActiveUnitRoleResultData[];
  laneLabel: string;
  isLocal: boolean;
  onRelease: () => void;
  testID: string;
  removeTestID: string;
}

export const UnitResourceCard: React.FC<UnitResourceCardProps> = ({ name, unit, status, roles, laneLabel, isLocal, onRelease, testID, removeTestID }) => {
  const { t } = useTranslation();
  const subtitle = [unit?.Type, unit?.GroupName].filter(Boolean).join(' • ');
  const filledRoles = roles.filter((role) => !!role.FullName || !!role.UserId);

  return (
    <CardShell isLocal={isLocal} onRelease={onRelease} testID={testID} removeTestID={removeTestID}>
      <HStack className="items-center" space="sm">
        <Box className="size-8 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950">
          <Truck className="text-primary-600 dark:text-primary-400" size={16} />
        </Box>
        <VStack className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white" {...oneLine}>
            {name}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-gray-500 dark:text-gray-400" {...oneLine}>
              {subtitle}
            </Text>
          ) : null}
        </VStack>
        {status?.State ? <ServerColorBadge color={status.StateStyle} label={status.State} testID={`${testID}-status`} /> : null}
      </HStack>

      {status?.DestinationName || status?.Eta ? (
        <HStack className="items-center" space="xs">
          <MapPin className="text-gray-400" size={12} />
          <Text className="text-xs text-gray-500 dark:text-gray-400" {...oneLine}>
            {[status?.DestinationName, status?.Eta ? t('command.unit_eta', { eta: status.Eta }) : ''].filter(Boolean).join(' • ')}
          </Text>
        </HStack>
      ) : null}

      {roles.length > 0 ? (
        <VStack className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800" space="xs" testID={`${testID}-roles`}>
          <Text className="text-2xs font-medium uppercase text-gray-500 dark:text-gray-400">{t('command.unit_roles_count', { filled: filledRoles.length, total: roles.length })}</Text>
          {roles.map((role) => (
            <HStack key={role.UnitRoleId} className="items-center justify-between" space="sm">
              <Text className="text-xs text-gray-500 dark:text-gray-400" {...oneLine}>
                {role.Name}
              </Text>
              <Text className={`text-xs font-medium ${role.FullName ? 'text-gray-900 dark:text-white' : 'italic text-gray-400 dark:text-gray-500'}`} {...oneLine}>
                {role.FullName || t('command.role_open')}
              </Text>
            </HStack>
          ))}
        </VStack>
      ) : null}

      <HStack>
        <LaneBadge label={laneLabel} />
      </HStack>
    </CardShell>
  );
};

interface PersonnelResourceCardProps {
  name: string;
  person?: PersonnelInfoResultData;
  laneLabel: string;
  isLocal: boolean;
  onRelease: () => void;
  testID: string;
  removeTestID: string;
}

export const PersonnelResourceCard: React.FC<PersonnelResourceCardProps> = ({ name, person, laneLabel, isLocal, onRelease, testID, removeTestID }) => {
  const initials = person ? `${person.FirstName?.[0] ?? ''}${person.LastName?.[0] ?? ''}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  const subtitle = [person?.GroupName, person?.IdentificationNumber].filter(Boolean).join(' • ');
  const statusDot = asHexColor(person?.StatusColor);

  return (
    <CardShell isLocal={isLocal} onRelease={onRelease} testID={testID} removeTestID={removeTestID}>
      <HStack className="items-center" space="sm">
        <Box className="size-8 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
          <Text className="text-xs font-bold text-primary-600 dark:text-primary-400">{initials}</Text>
          {statusDot ? <View style={[styles.statusDot, { backgroundColor: statusDot }]} /> : null}
        </Box>
        <VStack className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white" {...oneLine}>
            {name}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-gray-500 dark:text-gray-400" {...oneLine}>
              {subtitle}
            </Text>
          ) : null}
        </VStack>
        {person?.Status ? <ServerColorBadge color={person.StatusColor} label={person.Status} testID={`${testID}-status`} /> : null}
        {person?.Staffing ? <ServerColorBadge color={person.StaffingColor} label={person.Staffing} testID={`${testID}-staffing`} /> : null}
      </HStack>

      <HStack className="flex-wrap items-center" space="xs">
        <LaneBadge label={laneLabel} />
        {(person?.Roles ?? []).map((role) => (
          <Badge key={role} action="info" variant="outline">
            <BadgeText>{role}</BadgeText>
          </Badge>
        ))}
      </HStack>
    </CardShell>
  );
};

const styles = StyleSheet.create({
  badgeFallback: {
    backgroundColor: '#6b7280',
  },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
