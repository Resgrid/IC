import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDownIcon, SearchIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import * as z from 'zod';

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
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { type CallLocation, useCallLocationSearch } from '@/hooks/use-call-location-search';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { useToast } from '@/hooks/use-toast';
import { EDIT_CALL_UNENFORCED_KEYS, getCallFieldLabels, getEditCallFieldValues, getMissingRequiredCallFields, getMissingRequiredFieldsFromError, isPendingCallState } from '@/lib/call-field-policy';
import { parseCoordinate } from '@/lib/call-geolocation';
import { getScheduledDispatchPrefill, isScheduledDispatchTooSoon, MIN_SCHEDULED_DISPATCH_LEAD_MINUTES, toDispatchOnUtc } from '@/lib/call-schedule';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

// Form validation schema (same as New Call)
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nature: z.string().min(1, 'Nature is required'),
  note: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  what3words: z.string().optional(),
  plusCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  destinationPoiId: z.string().optional(),
  priority: z.string().min(1, 'Priority is required'),
  type: z.string().min(1, 'Type is required'),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
  externalId: z.string().optional(),
  incidentId: z.string().optional(),
  referenceId: z.string().optional(),
  dispatchOn: z.string().optional(),
  dispatchSelection: z.object({
    everyone: z.boolean(),
    users: z.array(z.string()),
    groups: z.array(z.string()),
    roles: z.array(z.string()),
    units: z.array(z.string()),
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditCall() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const callPriorities = useCallsStore((state) => state.callPriorities);
  const callTypes = useCallsStore((state) => state.callTypes);
  const destinationPois = useCallsStore((state) => state.destinationPois);
  const poiTypes = useCallsStore((state) => state.poiTypes);
  const callDataLoading = useCallsStore((state) => state.isLoading);
  const callDataError = useCallsStore((state) => state.error);
  const fetchCallFormData = useCallsStore((state) => state.fetchCallFormData);
  const call = useCallDetailStore((state) => state.call);
  const callExtraData = useCallDetailStore((state) => state.callExtraData);
  const callDetailLoading = useCallDetailStore((state) => state.isLoading);
  const callDetailError = useCallDetailStore((state) => state.error);
  const fetchCallDetail = useCallDetailStore((state) => state.fetchCallDetail);
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
  const [selectedLocation, setSelectedLocation] = useState<CallLocation | null>(null);
  // The scheduled dispatch time the form was loaded with. Only a time the dispatcher changed is sent:
  // resending the loaded one could fail the lead-time rule once it gets close, for no change at all.
  // While there is one, the picker offers no "clear": EditCall cannot remove a schedule, so clearing
  // would only empty the field while the stored time stays.
  const [loadedDispatchOn, setLoadedDispatchOn] = useState('');

  // The department's call field policy applies to edits as well: the same fields are hidden, and the
  // call must still have every required field once the edit is saved.
  const fieldPolicy = useNewCallFieldPolicy();

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
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

  const handleLocationSelected = (location: CallLocation) => {
    setSelectedLocation(location);
    setValue('latitude', location.latitude);
    setValue('longitude', location.longitude);
    if (location.address) {
      setValue('address', location.address);
    }
    setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    setShowLocationPicker(false);
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
    if (callId) {
      fetchCallDetail(callId);
    }
  }, [fetchCallDetail, fetchCallFormData, callId]);

  // Pre-populate form when call data is loaded
  useEffect(() => {
    if (call) {
      const priority = callPriorities.find((p) => p.Id === call.Priority);
      // Call.Type is the type's text, not its id -- matching on Id left the picker blank on every edit.
      const type = callTypes.find((t) => t.Name === call.Type);

      // Seed the picker with who the call already went to. Without this the edit posted an empty
      // dispatch list, which the API reads as "dispatch the whole department".
      const initialDispatch: DispatchSelection = {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      };

      if (callExtraData?.Dispatches) {
        callExtraData.Dispatches.forEach((dispatch) => {
          const dispatchType = (dispatch.Type || '').toLowerCase();
          if (dispatchType === 'personnel' || dispatchType === 'p' || dispatchType === 'user') {
            initialDispatch.users.push(dispatch.Id);
          } else if (dispatchType === 'group' || dispatchType === 'groups' || dispatchType === 'g') {
            initialDispatch.groups.push(dispatch.Id);
          } else if (dispatchType === 'role' || dispatchType === 'roles' || dispatchType === 'r') {
            initialDispatch.roles.push(dispatch.Id);
          } else if (dispatchType === 'unit' || dispatchType === 'units' || dispatchType === 'u') {
            initialDispatch.units.push(dispatch.Id);
          }
        });
      }

      setDispatchSelection(initialDispatch);

      const latitude = parseCoordinate(call.Latitude);
      const longitude = parseCoordinate(call.Longitude);
      // Only a call still waiting for its scheduled time has a schedule to edit.
      const dispatchOn = getScheduledDispatchPrefill(call.DispatchedOnUtc);
      setLoadedDispatchOn(dispatchOn);

      reset({
        name: call.Name || '',
        nature: call.Nature || '',
        note: call.Note || '',
        address: call.Address || '',
        coordinates: call.Geolocation || '',
        what3words: call.What3Words || '',
        // A plus code is only a way to find a location; it is never stored on the call.
        plusCode: '',
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        destinationPoiId: call.DestinationPoiId != null ? String(call.DestinationPoiId) : '',
        priority: priority?.Name || '',
        type: type?.Name || '',
        contactName: call.ContactName || '',
        contactInfo: call.ContactInfo || '',
        externalId: call.ExternalId || '',
        incidentId: call.IncidentId || '',
        referenceId: call.ReferenceId || '',
        dispatchOn,
        dispatchSelection: initialDispatch,
      });

      // Set selected location if coordinates exist
      if (latitude !== null && longitude !== null) {
        setSelectedLocation({
          latitude,
          longitude,
          address: call.Address || undefined,
        });
      }
    }
  }, [call, callExtraData, callPriorities, callTypes, reset]);

  // Track when edit call view is rendered
  useEffect(() => {
    if (call) {
      trackEvent('edit_call_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        callPriority: call.Priority || 0,
        callType: call.Type || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
        hasAddress: !!call.Address,
      });
    }
  }, [trackEvent, call]);

  const showMissingRequiredFields = (keys: readonly string[]) => {
    toast.error(t('calls.required_fields_missing', { fields: getCallFieldLabels(keys, t).join(', ') }));
  };

  const onSubmit = async (data: FormValues) => {
    if (!call) {
      return;
    }

    try {
      // Until the policy lands it reads as "nothing hidden, nothing required"; saving in that window
      // could post fields the department hides and skip the ones it requires.
      if (!fieldPolicy.isLoaded) {
        toast.error(t('calls.field_policy_loading'));
        return;
      }

      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      // A field the department hides is not on this form, so the save must leave it as it is. EditCall
      // reads blank text and missing coordinates as "keep what is stored". The destination and the
      // dispatch list are resent as loaded from the call rather than blanked: a current server keeps the
      // stored values for a hidden field either way, but an older one clears a missing destination and
      // reads an empty dispatch list as "page the whole department".
      const visible = fieldPolicy.isVisible;
      const keepGeolocation = !visible(NewCallFieldKeys.Geolocation);
      const submitted: FormValues = {
        ...data,
        note: visible(NewCallFieldKeys.Note) ? data.note : '',
        address: visible(NewCallFieldKeys.Address) ? data.address : '',
        what3words: visible(NewCallFieldKeys.What3Words) ? data.what3words : '',
        plusCode: visible(NewCallFieldKeys.PlusCode) ? data.plusCode : '',
        contactName: visible(NewCallFieldKeys.ContactName) ? data.contactName : '',
        contactInfo: visible(NewCallFieldKeys.ContactInfo) ? data.contactInfo : '',
        externalId: visible(NewCallFieldKeys.ExternalId) ? data.externalId : '',
        incidentId: visible(NewCallFieldKeys.IncidentId) ? data.incidentId : '',
        referenceId: visible(NewCallFieldKeys.ReferenceId) ? data.referenceId : '',
        latitude: keepGeolocation ? undefined : data.latitude,
        longitude: keepGeolocation ? undefined : data.longitude,
      };

      // The server checks the call as the edit leaves it, so the check here does too: a blank input
      // keeps the stored value. The dispatch time is never required on an edit, and the indoor location,
      // protocols and linked call are not enforced because this screen has no picker for them and does
      // not send them. A pending call has not been sent to anyone, so its dispatch list is not required.
      const missingFields = getMissingRequiredCallFields(fieldPolicy, getEditCallFieldValues(submitted, call), {
        unenforced: EDIT_CALL_UNENFORCED_KEYS,
        isPending: isPendingCallState(call.State),
      });

      if (missingFields.length > 0) {
        showMissingRequiredFields(missingFields);
        return;
      }

      // A new scheduled dispatch time has to leave time to act on it, the same rule as the web call form.
      // An unchanged, hidden or cleared time is not sent, which leaves the stored schedule as it is.
      const newDispatchOn = visible(NewCallFieldKeys.DispatchOn) && data.dispatchOn && data.dispatchOn !== loadedDispatchOn ? data.dispatchOn : '';

      if (isScheduledDispatchTooSoon(newDispatchOn)) {
        toast.error(t('calls.scheduled_dispatch_too_soon', { minutes: MIN_SCHEDULED_DISPATCH_LEAD_MINUTES }));
        return;
      }

      const priority = callPriorities.find((p) => p.Name === submitted.priority);
      const type = callTypes.find((t) => t.Name === submitted.type);

      // Update the call using the store
      await useCallDetailStore.getState().updateCall({
        callId: callId!,
        name: submitted.name,
        nature: submitted.nature,
        priority: priority?.Id || 0,
        // The API matches the call type by its text, not its id.
        type: type?.Name || '',
        note: submitted.note,
        address: submitted.address,
        latitude: submitted.latitude,
        longitude: submitted.longitude,
        destinationPoiId: submitted.destinationPoiId ? Number(submitted.destinationPoiId) : null,
        what3words: submitted.what3words,
        plusCode: submitted.plusCode,
        contactName: submitted.contactName,
        contactInfo: submitted.contactInfo,
        externalId: submitted.externalId,
        incidentId: submitted.incidentId,
        referenceId: submitted.referenceId,
        dispatchOnUtc: toDispatchOnUtc(newDispatchOn),
        dispatchUsers: submitted.dispatchSelection?.users,
        dispatchGroups: submitted.dispatchSelection?.groups,
        dispatchRoles: submitted.dispatchSelection?.roles,
        dispatchUnits: submitted.dispatchSelection?.units,
        dispatchEveryone: submitted.dispatchSelection?.everyone,
      });

      toast.success(t('call_detail.update_call_success'));

      // Navigate back to call detail
      router.back();
    } catch (error) {
      // The server enforces the policy too; if it disagrees with the one this form loaded, name the
      // fields it wants rather than a generic failure.
      const serverMissingFields = getMissingRequiredFieldsFromError(error);

      if (serverMissingFields) {
        showMissingRequiredFields(serverMissingFields);
        return;
      }

      console.error('Error updating call:', error);

      toast.error(t('call_detail.update_call_error'));
    }
  };

  const handleDispatchSelection = (selection: DispatchSelection) => {
    setDispatchSelection(selection);
    setValue('dispatchSelection', selection);
    setShowDispatchModal(false);
  };

  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) {
      return t('calls.everyone');
    }

    const totalSelected = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;

    if (totalSelected === 0) {
      return t('calls.select_recipients');
    }

    return `${totalSelected} ${t('calls.selected')}`;
  };

  if (callDetailLoading || callDataLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('calls.edit_call'),
            headerShown: true,
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerBackTitle: '',
          }}
        />
        <Loading />
      </>
    );
  }

  if (callDetailError || callDataError || !call) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('calls.edit_call'),
            headerShown: true,
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1">
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <Text className="error text-center">{callDetailError || callDataError || 'Call not found'}</Text>
          </Box>
        </View>
      </>
    );
  }

  // Same fields as the new call screen, each shown or hidden by the department's policy. The location
  // card groups five of them, so it only disappears once the policy has hidden all five.
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
  // Only a call that has gone out needs recipients; a pending call is not required to have any yet.
  const isDispatchListRequired = fieldPolicy.isRequired(NewCallFieldKeys.DispatchList) && !isPendingCallState(call.State);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('calls.edit_call'),
          headerShown: true,
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1">
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <ScrollView className="flex-1 px-4 py-6">
            <Text className="mb-6 text-2xl font-bold">{t('calls.edit_call_description')}</Text>

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
                    <Select selectedValue={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.priority_placeholder')} />
                        <SelectIcon as={ChevronDownIcon} />
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
                    <Select selectedValue={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.select_type')} />
                        <SelectIcon as={ChevronDownIcon} />
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
                        isLoading={callDataLoading && destinationPois.length === 0}
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

            {/* Never required on an edit: the dispatch time only matters before a call goes out. */}
            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchOn) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.scheduled_dispatch')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="dispatchOn"
                    render={({ field: { onChange, value } }) => (
                      <DateTimeField mode="datetime" value={value ?? ''} onChange={onChange} label={t('calls.scheduled_dispatch')} clearable={!loadedDispatchOn} testID="dispatch-on-field" />
                    )}
                  />
                  {loadedDispatchOn ? <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('calls.scheduled_dispatch_no_clear')}</Text> : null}
                </FormControl>
              </Card>
            ) : null}

            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchList) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <Text className="mb-4 text-lg font-semibold">
                  {t('calls.dispatch_to')}
                  {isDispatchListRequired ? ' *' : ''}
                </Text>
                <Button testID="dispatch-recipients-button" onPress={() => setShowDispatchModal(true)} className="w-full">
                  <ButtonText>{getDispatchSummary()}</ButtonText>
                </Button>
              </Card>
            ) : null}

            <Box className="mb-6 flex-row space-x-4">
              <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button testID="save-call-button" className="ml-10 flex-1" variant="solid" action="primary" isDisabled={!fieldPolicy.isLoaded} onPress={handleSubmit(onSubmit)}>
                <ButtonText>{t('common.save')}</ButtonText>
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
