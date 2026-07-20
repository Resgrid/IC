import { Plus } from 'lucide-react-native';
import React from 'react';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface CommandSectionProps {
  title: string;
  count: number;
  addLabel: string;
  emptyText: string;
  onAdd: () => void;
  testID: string;
  children?: React.ReactNode;
}

/** Card wrapper for an ICS board section (roles, resources, accountability). */
export const CommandSection: React.FC<CommandSectionProps> = ({ title, count, addLabel, emptyText, onAdd, testID, children }) => {
  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID={testID}>
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{title}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({count})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={onAdd} testID={`${testID}-add`}>
          <ButtonIcon as={Plus} />
          <ButtonText>{addLabel}</ButtonText>
        </Button>
      </HStack>

      {count === 0 ? <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{emptyText}</Text> : <VStack space="sm">{children}</VStack>}
    </Box>
  );
};
