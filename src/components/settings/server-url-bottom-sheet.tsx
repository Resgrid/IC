import { ChevronDownIcon } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { getSystemConfig } from '@/api/config';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import type { ResgridSystemLocation } from '@/models/v4/configs/getSystemConfigResultData';
import { useServerUrlStore } from '@/stores/app/server-url-store';
import useAuthStore from '@/stores/auth/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonSpinner, ButtonText } from '../ui/button';
import { Center } from '../ui/center';
import { FormControl, FormControlError, FormControlErrorText, FormControlHelperText, FormControlLabel, FormControlLabelText } from '../ui/form-control';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '../ui/select';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface ServerUrlForm {
  url: string;
}

interface ServerUrlBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a new URL is saved while signed in; tokens belong to the old server, so the caller should sign out. */
  onUrlChanged?: () => Promise<void>;
}

const URL_PATTERN = /^https?:\/\/.+/;
const CUSTOM_SERVER_VALUE = '__custom__';
const API_PATH_SUFFIX = `/api/${Env.API_VERSION}`;

const normalizeInputUrl = (url: string) => url.trim().replace(/\/+$/, '');

// Strips the `/api/{version}` suffix so stored API URLs and system config ApiUrls (which may or
// may not include it) compare equal. Any other path is kept for self-hosted installs under a sub-path.
const normalizeBaseUrl = (url: string) => {
  const trimmedUrl = normalizeInputUrl(url);

  if (trimmedUrl.endsWith(API_PATH_SUFFIX)) {
    return trimmedUrl.slice(0, -API_PATH_SUFFIX.length).replace(/\/+$/, '');
  }

  return trimmedUrl;
};

const buildApiUrl = (url: string) => `${normalizeBaseUrl(url)}${API_PATH_SUFFIX}`;

export function ServerUrlBottomSheet({ isOpen, onClose, onUrlChanged }: ServerUrlBottomSheetProps) {
  const { t } = useTranslation();
  const keyboardHeight = useKeyboardHeight();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingServerOptions, setIsLoadingServerOptions] = React.useState(true);
  const [locations, setLocations] = React.useState<ResgridSystemLocation[]>([]);
  const [selectedServer, setSelectedServer] = React.useState<string>(CUSTOM_SERVER_VALUE);
  const setUrl = useServerUrlStore((s) => s.setUrl);
  const getUrl = useServerUrlStore((s) => s.getUrl);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ServerUrlForm>();

  React.useEffect(() => {
    if (!isOpen) {
      setIsLoadingServerOptions(true);
      return undefined;
    }

    let isMounted = true;

    const loadServerOptions = async () => {
      try {
        const [currentUrl, systemConfig] = await Promise.all([getUrl(), getSystemConfig()]);
        const normalizedCurrentUrl = normalizeBaseUrl(currentUrl);
        const nextLocations = systemConfig.Data?.Locations ?? [];
        const matchingLocation = nextLocations.find((location) => normalizeBaseUrl(location.ApiUrl) === normalizedCurrentUrl);

        if (isMounted) {
          setLocations(nextLocations);
          setValue('url', matchingLocation ? normalizeInputUrl(matchingLocation.ApiUrl) : normalizedCurrentUrl);
          setSelectedServer(matchingLocation?.Name ?? CUSTOM_SERVER_VALUE);
        }
      } catch (error) {
        const currentUrl = await getUrl();

        if (isMounted) {
          setLocations([]);
          setValue('url', normalizeBaseUrl(currentUrl));
          setSelectedServer(CUSTOM_SERVER_VALUE);
        }

        logger.error({
          message: 'Failed to load system config for server URLs',
          context: { error },
        });
      } finally {
        if (isMounted) {
          setIsLoadingServerOptions(false);
        }
      }
    };

    loadServerOptions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, setValue, getUrl]);

  const onFormSubmit = async (data: ServerUrlForm) => {
    try {
      setIsLoading(true);
      const selectedLocation = locations.find((location) => location.Name === selectedServer);
      const resolvedBaseUrl = selectedServer === CUSTOM_SERVER_VALUE ? data.url : (selectedLocation?.ApiUrl ?? data.url);
      const normalizedResolvedBaseUrl = normalizeBaseUrl(resolvedBaseUrl);

      await setUrl(buildApiUrl(normalizedResolvedBaseUrl));

      if (isAuthenticated && onUrlChanged) {
        await onUrlChanged();
      }

      logger.info({
        message: 'Server URL updated successfully',
        context: { url: normalizedResolvedBaseUrl },
      });
      onClose();
    } catch (error) {
      logger.error({
        message: 'Failed to update server URL',
        context: { error },
      });

      setError('root', {
        message: error instanceof Error ? error.message : t('common.error'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleServerChange = useCallback(
    (nextServer: string) => {
      setSelectedServer(nextServer);

      if (nextServer === CUSTOM_SERVER_VALUE) {
        return;
      }

      const selectedLocation = locations.find((location) => location.Name === nextServer);

      if (selectedLocation) {
        setValue('url', normalizeInputUrl(selectedLocation.ApiUrl));
      }
    },
    [locations, setValue]
  );

  const isCustomSelected = selectedServer === CUSTOM_SERVER_VALUE;
  const selectedServerLabel = isCustomSelected ? t('settings.custom') : locations.find((location) => location.Name === selectedServer)?.Name;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      {/* Single sanctioned keyboard mechanism for sheets: pad the sheet by the keyboard
          height so the server URL field and the save buttons stay visible. Never nest a
          KeyboardAvoidingView (or stack a second inset adjuster) here — see
          use-keyboard-height.ts. */}
      <ActionsheetContent className="rounded-t-3xl bg-white px-4 dark:bg-neutral-900" style={{ paddingBottom: keyboardHeight }}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <VStack space="lg" className="mt-4 w-full">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{t('settings.server')}</FormControlLabelText>
              </FormControlLabel>
              {isLoadingServerOptions ? (
                <Center testID="server-options-loading" className="min-h-16 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
                  <ButtonSpinner />
                  <Text className="mt-2 text-neutral-600 dark:text-neutral-300">{t('loading.loadingData')}</Text>
                </Center>
              ) : (
                <Select onValueChange={handleServerChange} selectedValue={selectedServer}>
                  <SelectTrigger className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
                    <SelectInput placeholder={t('settings.server')} value={selectedServerLabel} />
                    <SelectIcon as={ChevronDownIcon} className="mr-3" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent className="max-h-[60vh] pb-20">
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {locations.map((location) => (
                        <SelectItem key={location.Name} label={location.Name} value={location.Name} />
                      ))}
                      <SelectItem label={t('settings.custom')} value={CUSTOM_SERVER_VALUE} />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              )}
            </FormControl>
            <FormControl isRequired={isCustomSelected} isInvalid={isCustomSelected ? !!errors.url : false}>
              <FormControlLabel>
                <FormControlLabelText className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{t('settings.server_url')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                control={control}
                name="url"
                rules={{
                  validate: (value) => {
                    if (!isCustomSelected) {
                      return true;
                    }

                    if (!value) {
                      return t('form.required');
                    }

                    return URL_PATTERN.test(value) ? true : t('form.invalid_url');
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <Input className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      placeholder={t('settings.enter_server_url')}
                      editable={isCustomSelected && !isLoadingServerOptions}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      textContentType="URL"
                      returnKeyType="done"
                      autoFocus={false}
                      blurOnSubmit={true}
                    />
                  </Input>
                )}
              />
              <FormControlHelperText>
                <FormControlError>
                  <FormControlErrorText>{errors.url?.message}</FormControlErrorText>
                </FormControlError>
              </FormControlHelperText>
            </FormControl>
            <Center>
              <Text size="md" className="text-center text-red-500">
                {t('settings.server_url_note')}
              </Text>
            </Center>

            {errors.root?.message ? (
              <Text size="sm" className="w-full text-center text-red-500">
                {errors.root.message}
              </Text>
            ) : null}

            <HStack space="md" className="mt-4">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="flex-1 bg-primary-600" onPress={handleSubmit(onFormSubmit)} disabled={isLoading || isLoadingServerOptions}>
                {isLoading ? <ButtonSpinner /> : <ButtonText>{t('common.save')}</ButtonText>}
              </Button>
            </HStack>
          </VStack>
        </ScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
