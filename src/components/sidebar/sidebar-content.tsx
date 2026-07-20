import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight, ClipboardList, CloudAlert, Layers, Map, Megaphone, Settings } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface SidebarProps {
  onClose?: () => void;
}

interface MenuItem {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'map', labelKey: 'tabs.map', icon: Map, href: '/' },
  { key: 'calls', labelKey: 'tabs.calls', icon: Megaphone, href: '/calls' },
  { key: 'command', labelKey: 'tabs.command_board', icon: ClipboardList, href: '/command' },
  { key: 'maps', labelKey: 'maps.title', icon: Layers, href: '/maps' },
  { key: 'weather-alerts', labelKey: 'tabs.weather_alerts', icon: CloudAlert, href: '/weather-alerts' },
  { key: 'settings', labelKey: 'tabs.settings', icon: Settings, href: '/settings' },
];

const Sidebar = ({ onClose }: SidebarProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleNavigate = (href: string) => {
    onClose?.();
    router.push(href as never);
  };

  return (
    <ScrollView className="size-full pt-4" contentContainerStyle={{ flexGrow: 1 }}>
      <VStack space="xs" className="w-full flex-1 p-2">
        <Text className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('sidebar.menu')}</Text>

        {MENU_ITEMS.map((item) => (
          <Pressable key={item.key} testID={`sidebar-link-${item.key}`} className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-gray-100 dark:active:bg-gray-800" onPress={() => handleNavigate(item.href)}>
            <Icon as={item.icon} size="lg" className="text-primary-500 dark:text-primary-400" />
            <Text className="flex-1 text-base font-medium text-gray-900 dark:text-white">{t(item.labelKey)}</Text>
            <Icon as={ChevronRight} size="sm" className="text-gray-400 dark:text-gray-500" />
          </Pressable>
        ))}
      </VStack>
    </ScrollView>
  );
};

export default Sidebar;
