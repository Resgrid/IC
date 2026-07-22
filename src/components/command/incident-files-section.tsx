import * as DocumentPicker from 'expo-document-picker';
import { documentDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadIncidentAttachment } from '@/api/incidentCommand/incidentCommand';
import { AlertDialog, AlertDialogBackdrop, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader } from '@/components/ui/alert-dialog';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { sanitizeFileName } from '@/lib/utils';
import { type IncidentAttachment, IncidentContentVisibility } from '@/models/v4/incidentCommand/incidentCommandModels';
import { useToastStore } from '@/stores/toast/store';

interface IncidentFilesSectionProps {
  attachments: IncidentAttachment[];
  /** Upload a picked file; resolves true on success. */
  onUpload: (visibility: number, description: string | null, file: { uri: string; name: string; type: string }) => Promise<boolean>;
  onRemove: (incidentAttachmentId: string) => void;
}

/** Incident-level files (reports, images, documents): list, upload, open/share, and remove. */
export const IncidentFilesSection: React.FC<IncidentFilesSectionProps> = ({ attachments, onUpload, onRemove }) => {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const [isUploading, setIsUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handlePickAndUpload = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }
      const asset = picked.assets[0];
      setIsUploading(true);
      const ok = await onUpload(IncidentContentVisibility.Internal, null, {
        uri: asset.uri,
        name: asset.name ?? 'attachment',
        type: asset.mimeType ?? 'application/octet-stream',
      });
      showToast(ok ? 'success' : 'error', ok ? t('command.incident_files_uploaded') : t('command.incident_files_upload_error'));
    } catch (error) {
      logger.error({ message: 'Incident file pick/upload failed', context: { error } });
      showToast('error', t('command.incident_files_upload_error'));
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, showToast, t]);

  // Same download flow the call files modal uses: blob → base64 → local file → share sheet.
  const handleOpen = useCallback(
    async (attachment: IncidentAttachment) => {
      setOpeningId(attachment.IncidentAttachmentId);
      try {
        const blob = await downloadIncidentAttachment(attachment.IncidentAttachmentId);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        // FileName is server-stored data — reduce it to a basename so a value containing path
        // separators or ".." segments can never write outside documentDirectory.
        const fileUri = `${documentDirectory}${sanitizeFileName(attachment.FileName)}`;
        await writeAsStringAsync(fileUri, base64, { encoding: EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: attachment.ContentType || 'application/octet-stream', dialogTitle: attachment.FileName });
        }
      } catch (error) {
        logger.error({ message: 'Incident file open failed', context: { error, incidentAttachmentId: attachment.IncidentAttachmentId } });
        showToast('error', t('command.incident_files_open_error'));
      } finally {
        setOpeningId(null);
      }
    },
    [showToast, t]
  );

  return (
    <Box className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800" testID="command-incident-files-section">
      <HStack className="mb-3 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Icon as={Paperclip} size="sm" className="text-gray-500" />
          <Heading size="sm">{t('command.incident_files_section')}</Heading>
          <Text className="text-sm text-gray-500 dark:text-gray-400">({attachments.length})</Text>
        </HStack>
        <Button size="xs" variant="outline" onPress={handlePickAndUpload} isDisabled={isUploading} testID="incident-files-upload">
          {isUploading ? <Spinner size="small" /> : <ButtonIcon as={Upload} />}
          <ButtonText>{t('command.incident_files_upload')}</ButtonText>
        </Button>
      </HStack>

      {attachments.length === 0 ? (
        <Text className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('command.incident_files_empty')}</Text>
      ) : (
        <VStack space="sm">
          {attachments.map((attachment) => (
            <Pressable key={attachment.IncidentAttachmentId} onPress={() => handleOpen(attachment)} testID={`incident-file-${attachment.IncidentAttachmentId}`}>
              <HStack space="sm" className="items-center rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                {openingId === attachment.IncidentAttachmentId ? <Spinner size="small" /> : <Icon as={FileText} size="sm" className="text-gray-500" />}
                <VStack className="min-w-0 flex-1">
                  <Text className="text-sm text-gray-900 dark:text-white" numberOfLines={1}>
                    {attachment.FileName}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                    {`${Math.max(1, Math.round(attachment.ContentLength / 1024))} KB • ${new Date(attachment.UploadedOn).toLocaleString()}`}
                  </Text>
                </VStack>
                <Pressable onPress={() => setPendingDeleteId(attachment.IncidentAttachmentId)} className="p-2" testID={`incident-file-delete-${attachment.IncidentAttachmentId}`}>
                  <Icon as={Trash2} size="sm" className="text-gray-400" />
                </Pressable>
              </HStack>
            </Pressable>
          ))}
        </VStack>
      )}

      <AlertDialog isOpen={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="incident-file-delete-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('command.incident_files_delete_title')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-gray-700 dark:text-gray-300">{t('command.incident_files_delete_message')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setPendingDeleteId(null)} testID="incident-file-delete-cancel">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={() => {
                const id = pendingDeleteId;
                setPendingDeleteId(null);
                if (id) {
                  onRemove(id);
                }
              }}
              testID="incident-file-delete-confirm"
            >
              <ButtonText>{t('command.incident_map_delete')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
};
