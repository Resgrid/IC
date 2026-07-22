import { Globe, Lock } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { getTimeAgoUtc } from '@/lib/utils';
import { IncidentContentVisibility, type IncidentNote } from '@/models/v4/incidentCommand/incidentCommandModels';

interface NotesSectionProps {
  notes: IncidentNote[];
  /** Omit to render read-only (ended incidents). */
  onAdd?: (body: string, visibility: number) => void;
}

/**
 * Operational status notes on the command board. Public notes land verbatim on the incident log;
 * non-public notes only leave an attributed marker there (author + note id) — never the body.
 */
export const NotesSection: React.FC<NotesSectionProps> = ({ notes, onAdd }) => {
  const { t } = useTranslation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<number>(IncidentContentVisibility.Internal);

  const handleSave = useCallback(() => {
    if (!body.trim() || !onAdd) {
      return;
    }
    onAdd(body.trim(), visibility);
    setBody('');
    setVisibility(IncidentContentVisibility.Internal);
    setIsAddOpen(false);
  }, [body, visibility, onAdd]);

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-notes-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Heading size="sm">{t('command.notes_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({notes.length})</Text>
        </HStack>
        {onAdd ? (
          <Button size="xs" variant="outline" onPress={() => setIsAddOpen(true)} testID="command-notes-add">
            <ButtonText>{t('command.add_note')}</ButtonText>
          </Button>
        ) : null}
      </HStack>

      {notes.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.empty_notes')}</Text>
      ) : (
        <VStack space="sm">
          {notes.map((note) => (
            <VStack key={note.IncidentNoteId} space="xs" className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900" testID={`note-${note.IncidentNoteId}`}>
              <HStack className="items-center justify-between">
                <Badge action={note.Visibility === IncidentContentVisibility.Public ? 'success' : 'muted'} size="sm" variant="outline">
                  <Icon as={note.Visibility === IncidentContentVisibility.Public ? Globe : Lock} size="xs" className="mr-1" />
                  <BadgeText>{note.Visibility === IncidentContentVisibility.Public ? t('command.note_public') : t('command.note_internal')}</BadgeText>
                </Badge>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{getTimeAgoUtc(note.CreatedOn)}</Text>
              </HStack>
              {note.Title ? <Text className="text-sm font-semibold text-gray-900 dark:text-white">{note.Title}</Text> : null}
              <Text className="text-sm text-gray-800 dark:text-gray-200">{note.Body}</Text>
            </VStack>
          ))}
        </VStack>
      )}

      <CustomBottomSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} snapPoints={[55]} testID="command-add-note-sheet">
        <VStack space="md" className="w-full">
          <Heading size="md">{t('command.add_note')}</Heading>

          <Textarea size="md" className="h-28">
            <TextareaInput placeholder={t('command.note_placeholder')} value={body} onChangeText={setBody} testID="command-note-input" multiline />
          </Textarea>

          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('command.note_visibility_label')}</Text>
            <HStack space="sm">
              <Pressable
                onPress={() => setVisibility(IncidentContentVisibility.Internal)}
                className={`flex-1 flex-row items-center justify-center rounded-lg border px-3 py-2 ${visibility === IncidentContentVisibility.Internal ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-gray-300 dark:border-gray-700'}`}
                testID="command-note-visibility-internal"
              >
                <Icon as={Lock} size="sm" className="mr-2 text-gray-600 dark:text-gray-300" />
                <Text className="text-sm text-gray-800 dark:text-gray-200">{t('command.note_internal')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setVisibility(IncidentContentVisibility.Public)}
                className={`flex-1 flex-row items-center justify-center rounded-lg border px-3 py-2 ${visibility === IncidentContentVisibility.Public ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-gray-300 dark:border-gray-700'}`}
                testID="command-note-visibility-public"
              >
                <Icon as={Globe} size="sm" className="mr-2 text-gray-600 dark:text-gray-300" />
                <Text className="text-sm text-gray-800 dark:text-gray-200">{t('command.note_public')}</Text>
              </Pressable>
            </HStack>
            <Text className="text-xs text-gray-500 dark:text-gray-400">{visibility === IncidentContentVisibility.Public ? t('command.note_public_hint') : t('command.note_internal_hint')}</Text>
          </VStack>

          <Button size="lg" onPress={handleSave} isDisabled={!body.trim()} testID="command-note-save">
            <ButtonText>{t('command.save')}</ButtonText>
          </Button>
        </VStack>
      </CustomBottomSheet>
    </Box>
  );
};
