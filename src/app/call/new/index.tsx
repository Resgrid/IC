import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as z from 'zod';

import { createCall } from '@/api/calls/calls';
import { DestinationPoiSelector } from '@/components/calls/destination-poi-selector';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { DateTimeField } from '@/components/common/date-time-field';
import { HeaderBackButton } from '@/components/common/header-back-button';
import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { ChevronDownIcon, PlusIcon, SearchIcon } from '@/components/ui/lucide-icons';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { type CallLocation, useCallLocationSearch } from '@/hooks/use-call-location-search';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { useToast } from '@/hooks/use-toast';
import { getCallFieldLabels, getMissingRequiredCallFields, getMissingRequiredFieldsFromError, getNewCallFieldValues, NEW_CALL_UNENFORCED_KEYS } from '@/lib/call-field-policy';
import { isScheduledDispatchTooSoon, MIN_SCHEDULED_DISPATCH_LEAD_MINUTES, toDispatchOnUtc } from '@/lib/call-schedule';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

// Define the form schema using zod
const formSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  nature: z.string().min(1, { message: 'Nature is required' }),
  note: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  what3words: z.string().optional(),
  plusCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  destinationPoiId: z.string().optional(),
  priority: z.string().min(1, { message: 'Priority is required' }),
  type: z.string().min(1, { message: 'Type is required' }),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
  externalId: z.string().optional(),
  incidentId: z.string().optional(),
  referenceId: z.string().optional(),
  dispatchOn: z.string().optional(),
  dispatchSelection: z
    .object({
      everyone: z.boolean(),
      users: z.array(z.string()),
      groups: z.array(z.string()),
      roles: z.array(z.string()),
      units: z.array(z.string()),
    })
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewCall() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const callPriorities = useCallsStore((state) => state.callPriorities);
  const callTypes = useCallsStore((state) => state.callTypes);
  const destinationPois = useCallsStore((state) => state.destinationPois);
  const poiTypes = useCallsStore((state) => state.poiTypes);
  const isLoading = useCallsStore((state) => state.isLoading);
  const error = useCallsStore((state) => state.error);
  const fetchCallFormData = useCallsStore((state) => state.fetchCallFormData);
  const { trackEvent } = useAnalytics();
  const toast = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection>({
    everyone: false,
    users: [],
    groups: [],
    roles: [],
    units: [],
  });

  // The department's new-call field policy: hides fields it does not use and blocks submission
  // until the ones it marked required have values. Unconfigured departments see the stock form.
  const fieldPolicy = useNewCallFieldPolicy();
  const [selectedLocation, setSelectedLocation] = useState<CallLocation | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      nature: '',
      note: '',
      address: '',
      coordinates: '',
      what3words: '',
      plusCode: '',
      latitude: undefined,
      longitude: undefined,
      destinationPoiId: '',
      priority: '',
      type: '',
      contactName: '',
      contactInfo: '',
      externalId: '',
      incidentId: '',
      referenceId: '',
      dispatchOn: '',
      dispatchSelection: {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      },
    },
  });

  // Handle location selection from the full-screen picker, the map preview or a location search
  const handleLocationSelected = (location: CallLocation) => {
    setSelectedLocation(location);
    setShowLocationPicker(false);

    // Update form values
    setValue('latitude', location.latitude);
    setValue('longitude', location.longitude);

    if (location.address) {
      setValue('address', location.address);
    }

    // Format coordinates as string
    setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
  };

  const {
    isGeocodingAddress,
    isGeocodingPlusCode,
    isGeocodingCoordinates,
    isGeocodingWhat3Words,
    addressResults,
    showAddressSelection,
    setShowAddressSelection,
    handleAddressSearch,
    handleAddressSelected,
    handleWhat3WordsSearch,
    handlePlusCodeSearch,
    handleCoordinatesSearch,
  } = useCallLocationSearch({ onLocationSelected: handleLocationSelected });

  useEffect(() => {
    fetchCallFormData();
  }, [fetchCallFormData]);

  // Track when new call view is rendered
  useEffect(() => {
    trackEvent('new_call_view_rendered', {
      prioritiesCount: callPriorities.length,
      typesCount: callTypes.length,
    });
  }, [trackEvent, callPriorities.length, callTypes.length]);

  const showMissingRequiredFields = (keys: readonly string[]) => {
    toast.error(t('calls.required_fields_missing', { fields: getCallFieldLabels(keys, t).join(', ') }));
  };

  const onSubmit = async (data: FormValues) => {
    try {
      // The policy arrives asynchronously and reads as "nothing required" until it lands, so a
      // submit in that window would skip every field the department marked required. Hold the call
      // back instead. Fail-open only applies once the lookup has finished one way or the other.
      if (!fieldPolicy.isLoaded) {
        toast.error(t('calls.field_policy_loading'));
        return;
      }

      // If we have latitude and longitude, add them to the data — before the policy check, so the
      // check sees the location that will actually be sent.
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      // The department may require fields beyond the built-in mandatory four. Enforced here for a
      // clear message, and again on the server so an old build cannot slip an incomplete call past.
      // Values are the ones createCall sends. The indoor location, protocols and linked call are left
      // out — this app never sends them, and the server only enforces them for a client that does.
      const missingFields = getMissingRequiredCallFields(fieldPolicy, getNewCallFieldValues(data), { unenforced: NEW_CALL_UNENFORCED_KEYS });

      if (missingFields.length > 0) {
        showMissingRequiredFields(missingFields);
        return;
      }

      // A scheduled dispatch has to leave time to act on it, the same rule as the web call form.
      if (isScheduledDispatchTooSoon(data.dispatchOn)) {
        toast.error(t('calls.scheduled_dispatch_too_soon', { minutes: MIN_SCHEDULED_DISPATCH_LEAD_MINUTES }));
        return;
      }

      // Validate priority and type before proceeding
      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      if (!priority) {
        toast.error(t('calls.invalid_priority'));
        return;
      }

      if (!type) {
        toast.error(t('calls.invalid_type'));
        return;
      }

      await createCall({
        name: data.name,
        nature: data.nature,
        priority: priority.Id,
        // The API matches the call type by its text, not its id.
        type: type.Name,
        note: data.note,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        destinationPoiId: data.destinationPoiId ? Number(data.destinationPoiId) : null,
        what3words: data.what3words,
        plusCode: data.plusCode,
        contactName: data.contactName,
        contactInfo: data.contactInfo,
        externalId: data.externalId,
        incidentId: data.incidentId,
        referenceId: data.referenceId,
        dispatchOnUtc: toDispatchOnUtc(data.dispatchOn),
        dispatchUsers: data.dispatchSelection?.users,
        dispatchGroups: data.dispatchSelection?.groups,
        dispatchRoles: data.dispatchSelection?.roles,
        dispatchUnits: data.dispatchSelection?.units,
        dispatchEveryone: data.dispatchSelection?.everyone,
      });

      // Show success toast
      toast.success(t('calls.create_success'));

      // Navigate back to calls list
      router.push('/calls');
    } catch (error) {
      // The server enforces the policy too; if it disagrees with the one this form loaded (changed in
      // between, or the lookup failed and the form fell open), name the fields it wants.
      const serverMissingFields = getMissingRequiredFieldsFromError(error);

      if (serverMissingFields) {
        showMissingRequiredFields(serverMissingFields);
        return;
      }

      console.error('Error creating call:', error);

      // Show error toast
      toast.error(t('calls.create_error'));
    }
  };

  // Handle dispatch selection
  const handleDispatchSelection = (selection: DispatchSelection) => {
    setDispatchSelection(selection);
    setValue('dispatchSelection', selection);
  };

  // Get dispatch selection summary
  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) {
      return t('calls.everyone');
    }

    const count = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;

    if (count === 0) {
      return t('calls.select_recipients');
    }

    return `${count} ${t('calls.selected')}`;
  };

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <View className="size-full flex-1">
        <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
          <Text className="error text-center">{error}</Text>
        </Box>
      </View>
    );
  }

  // Every rule the department can set drives its own control. The location card groups five of
  // them, so it only disappears once the policy has hidden all five.
  const showAddress = fieldPolicy.isVisible(NewCallFieldKeys.Address);
  const showGeolocation = fieldPolicy.isVisible(NewCallFieldKeys.Geolocation);
  const showWhat3Words = fieldPolicy.isVisible(NewCallFieldKeys.What3Words);
  const showPlusCode = fieldPolicy.isVisible(NewCallFieldKeys.PlusCode);
  const showDestinationPoi = fieldPolicy.isVisible(NewCallFieldKeys.DestinationPoi);
  const showLocationCard = showAddress || showGeolocation || showWhat3Words || showPlusCode || showDestinationPoi;
  // The server always enforces these when required, so each needs an input here.
  const showExternalId = fieldPolicy.isVisible(NewCallFieldKeys.ExternalId);
  const showIncidentId = fieldPolicy.isVisible(NewCallFieldKeys.IncidentId);
  const showReferenceId = fieldPolicy.isVisible(NewCallFieldKeys.ReferenceId);

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: t('calls.new_call'),
          headerShown: true,
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1">
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }} style={{ paddingTop: Math.max(insets.top, 16) }}>
            <Text className="mb-6 text-2xl font-bold">{t('calls.create_new_call')}</Text>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <FormControl isInvalid={!!errors.name}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.name')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
                {errors.name && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.name.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <FormControl isInvalid={!!errors.nature}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.nature')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="nature"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Textarea>
                      <TextareaInput value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.nature_placeholder')} />
                    </Textarea>
                  )}
                />
                {errors.nature && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.nature.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <FormControl isInvalid={!!errors.priority}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.priority')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field: { onChange, value } }) => (
                    <Select onValueChange={onChange} selectedValue={value}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.select_priority')} className="w-5/6" />
                        <SelectIcon as={ChevronDownIcon} className="mr-3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          {callPriorities.map((priority) => (
                            <SelectItem key={priority.Id} label={priority.Name} value={priority.Name} />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  )}
                />
                {errors.priority && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.priority.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <FormControl isInvalid={!!errors.type}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.type')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="type"
                  render={({ field: { onChange, value } }) => (
                    <Select onValueChange={onChange} selectedValue={value}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.select_type')} className="w-5/6" />
                        <SelectIcon as={ChevronDownIcon} className="mr-3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          {callTypes.map((type) => (
                            <SelectItem key={type.Id} label={type.Name} value={type.Name} />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  )}
                />
                {errors.type && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.type.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            {fieldPolicy.isVisible(NewCallFieldKeys.Note) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Note)}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.note')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="note"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Textarea>
                        <TextareaInput testID="note-input" value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.note_placeholder')} />
                      </Textarea>
                    )}
                  />
                </FormControl>
              </Card>
            ) : null}

            {showLocationCard ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <Text className="mb-4 text-lg font-semibold">{t('calls.call_location')}</Text>

                {/* Address Field */}
                {showAddress ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Address)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.address')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="address"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Box className="flex-row items-center space-x-2">
                          <Box className="flex-1">
                            <Input>
                              <InputField testID="address-input" placeholder={t('calls.address_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                            </Input>
                          </Box>
                          <Button testID="address-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handleAddressSearch(value || '')} disabled={isGeocodingAddress || !value?.trim()}>
                            {isGeocodingAddress ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                          </Button>
                        </Box>
                      )}
                    />
                  </FormControl>
                ) : null}

                {/* GPS Coordinates Field */}
                {showGeolocation ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Geolocation)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.coordinates')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="coordinates"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Box className="flex-row items-center space-x-2">
                          <Box className="flex-1">
                            <Input>
                              <InputField testID="coordinates-input" placeholder={t('calls.coordinates_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                            </Input>
                          </Box>
                          <Button testID="coordinates-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handleCoordinatesSearch(value || '')} disabled={isGeocodingCoordinates || !value?.trim()}>
                            {isGeocodingCoordinates ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                          </Button>
                        </Box>
                      )}
                    />
                  </FormControl>
                ) : null}

                {/* what3words Field */}
                {showWhat3Words ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.What3Words)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.what3words')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="what3words"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Box className="flex-row items-center space-x-2">
                          <Box className="flex-1">
                            <Input>
                              <InputField testID="what3words-input" placeholder={t('calls.what3words_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                            </Input>
                          </Box>
                          <Button testID="what3words-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handleWhat3WordsSearch(value || '')} disabled={isGeocodingWhat3Words || !value?.trim()}>
                            {isGeocodingWhat3Words ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                          </Button>
                        </Box>
                      )}
                    />
                  </FormControl>
                ) : null}

                {/* Plus Code Field */}
                {showPlusCode ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.PlusCode)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.plus_code')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="plusCode"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Box className="flex-row items-center space-x-2">
                          <Box className="flex-1">
                            <Input>
                              <InputField testID="plus-code-input" placeholder={t('calls.plus_code_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                            </Input>
                          </Box>
                          <Button testID="plus-code-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handlePlusCodeSearch(value || '')} disabled={isGeocodingPlusCode || !value?.trim()}>
                            {isGeocodingPlusCode ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                          </Button>
                        </Box>
                      )}
                    />
                  </FormControl>
                ) : null}

                {/* Map Preview — the map is how a dispatcher fills the geolocation in. */}
                {showGeolocation ? (
                  <Box className="mb-4">
                    {selectedLocation ? (
                      <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                    ) : (
                      <Button onPress={() => setShowLocationPicker(true)} className="w-full">
                        <ButtonText>{t('calls.select_location')}</ButtonText>
                      </Button>
                    )}
                  </Box>
                ) : null}

                {showDestinationPoi ? (
                  <Controller
                    control={control}
                    name="destinationPoiId"
                    render={({ field: { onChange, value } }) => (
                      <DestinationPoiSelector
                        destinationPois={destinationPois}
                        poiTypes={poiTypes}
                        selectedPoiId={value ? Number(value) : null}
                        isLoading={isLoading && destinationPois.length === 0}
                        isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DestinationPoi)}
                        onChange={(poiId) => onChange(poiId != null ? poiId.toString() : '')}
                      />
                    )}
                  />
                ) : null}
              </Card>
            ) : null}

            {fieldPolicy.isVisible(NewCallFieldKeys.ContactName) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactName)}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.contact_name')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="contactName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input>
                        <InputField testID="contact-name-input" placeholder={t('calls.contact_name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                      </Input>
                    )}
                  />
                </FormControl>
              </Card>
            ) : null}

            {fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactInfo)}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.contact_info')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="contactInfo"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input>
                        <InputField testID="contact-info-input" placeholder={t('calls.contact_info_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                      </Input>
                    )}
                  />
                </FormControl>
              </Card>
            ) : null}

            {showExternalId || showIncidentId || showReferenceId ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                {showExternalId ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ExternalId)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('call_detail.external_id')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="externalId"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input>
                          <InputField testID="external-id-input" placeholder={t('call_detail.external_id')} value={value} onChangeText={onChange} onBlur={onBlur} />
                        </Input>
                      )}
                    />
                  </FormControl>
                ) : null}

                {showIncidentId ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.IncidentId)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.incident_id')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="incidentId"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input>
                          <InputField testID="incident-id-input" placeholder={t('calls.incident_id')} value={value} onChangeText={onChange} onBlur={onBlur} />
                        </Input>
                      )}
                    />
                  </FormControl>
                ) : null}

                {showReferenceId ? (
                  <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ReferenceId)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('call_detail.reference_id')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="referenceId"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input>
                          <InputField testID="reference-id-input" placeholder={t('call_detail.reference_id')} value={value} onChangeText={onChange} onBlur={onBlur} />
                        </Input>
                      )}
                    />
                  </FormControl>
                ) : null}
              </Card>
            ) : null}

            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchOn) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DispatchOn)}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.scheduled_dispatch')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="dispatchOn"
                    render={({ field: { onChange, value } }) => <DateTimeField mode="datetime" value={value ?? ''} onChange={onChange} label={t('calls.scheduled_dispatch')} testID="dispatch-on-field" />}
                  />
                </FormControl>
              </Card>
            ) : null}

            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchList) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <Text className="mb-4 text-lg font-semibold">
                  {t('calls.dispatch_to')}
                  {fieldPolicy.isRequired(NewCallFieldKeys.DispatchList) ? ' *' : ''}
                </Text>
                <Button testID="dispatch-recipients-button" onPress={() => setShowDispatchModal(true)} className="w-full">
                  <ButtonText>{getDispatchSummary()}</ButtonText>
                </Button>
              </Card>
            ) : null}

            <Box className="mb-6 flex-row space-x-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button testID="create-call-button" className="ml-10 flex-1" variant="solid" action="primary" isDisabled={!fieldPolicy.isLoaded} onPress={handleSubmit(onSubmit)}>
                <PlusIcon size={18} className="mr-2 text-typography-0" />
                <ButtonText>{t('calls.create')}</ButtonText>
              </Button>
            </Box>
          </ScrollView>
        </Box>
      </View>

      {/* Full-screen location picker overlay */}
      {showLocationPicker && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
        >
          <FullScreenLocationPicker
            key={showLocationPicker ? 'location-picker-open' : 'location-picker-closed'}
            initialLocation={selectedLocation || undefined}
            onLocationSelected={handleLocationSelected}
            onClose={() => setShowLocationPicker(false)}
          />
        </View>
      )}

      {/* Dispatch selection modal */}
      <DispatchSelectionModal isVisible={showDispatchModal} onClose={() => setShowDispatchModal(false)} onConfirm={handleDispatchSelection} initialSelection={dispatchSelection} />

      {/* Address selection bottom sheet */}
      <CustomBottomSheet isOpen={showAddressSelection} onClose={() => setShowAddressSelection(false)} isLoading={false}>
        <Box className="p-4">
          <Text className="mb-4 text-center text-lg font-semibold">{t('calls.select_address')}</Text>
          <ScrollView className="max-h-96">
            {addressResults.map((result, index) => (
              <Button key={result.place_id || index} variant="outline" className="mb-2 w-full" onPress={() => handleAddressSelected(result)}>
                <ButtonText className="flex-1 text-left" numberOfLines={2}>
                  {result.formatted_address}
                </ButtonText>
              </Button>
            ))}
          </ScrollView>
        </Box>
      </CustomBottomSheet>
    </>
  );
}
