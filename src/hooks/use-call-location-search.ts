import axios from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';

/**
 * The location lookups behind the call form's address, GPS coordinates, what3words and plus code
 * inputs. Shared by the new-call and edit-call screens so both offer the same fields and the same
 * search behaviour.
 */

export interface CallLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

// Google Maps Geocoding API response types
export interface GeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

// what3words API response types
interface What3WordsResponse {
  coordinates: {
    lng: number;
    lat: number;
  };
  nearestPlace: string;
  words: string;
}

interface UseCallLocationSearchOptions {
  /** Called with every location a search resolves; the screen updates its form and map from it. */
  onLocationSelected: (location: CallLocation) => void;
}

export const useCallLocationSearch = ({ onLocationSelected }: UseCallLocationSearchOptions) => {
  const { t } = useTranslation();
  const toast = useToast();
  const config = useCoreStore((state) => state.config);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isGeocodingPlusCode, setIsGeocodingPlusCode] = useState(false);
  const [isGeocodingCoordinates, setIsGeocodingCoordinates] = useState(false);
  const [isGeocodingWhat3Words, setIsGeocodingWhat3Words] = useState(false);
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [showAddressSelection, setShowAddressSelection] = useState(false);

  /**
   * Geocodes an address with the Google Maps Geocoding API. A single result is selected directly;
   * several open the address picker so the dispatcher chooses one.
   */
  const handleAddressSearch = async (address: string) => {
    if (!address.trim()) {
      toast.warning(t('calls.address_required'));
      return;
    }

    setIsGeocodingAddress(true);
    try {
      const apiKey = config?.GoogleMapsKey;

      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const results = response.data.results;

        if (results.length === 1) {
          const result = results[0];

          onLocationSelected({
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            address: result.formatted_address,
          });

          toast.success(t('calls.address_found'));
        } else {
          setAddressResults(results);
          setShowAddressSelection(true);
        }
      } else {
        toast.error(t('calls.address_not_found'));
      }
    } catch (error) {
      logger.error({ message: 'Error geocoding address', context: { error } });
      toast.error(t('calls.geocoding_error'));
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  /** Selects one of several address search results. */
  const handleAddressSelected = (result: GeocodingResult) => {
    onLocationSelected({
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address: result.formatted_address,
    });
    setShowAddressSelection(false);

    toast.success(t('calls.address_found'));
  };

  /** Resolves a what3words address ("filled.count.soap") to coordinates with the what3words API. */
  const handleWhat3WordsSearch = async (what3words: string) => {
    if (!what3words.trim()) {
      toast.warning(t('calls.what3words_required'));
      return;
    }

    // Three words separated by dots
    const w3wRegex = /^[a-z]+\.[a-z]+\.[a-z]+$/;
    if (!w3wRegex.test(what3words.trim().toLowerCase())) {
      toast.warning(t('calls.what3words_invalid_format'));
      return;
    }

    setIsGeocodingWhat3Words(true);
    try {
      const apiKey = config?.W3WKey;

      if (!apiKey) {
        throw new Error('what3words API key not configured');
      }

      const response = await axios.get<What3WordsResponse>(`https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(what3words)}&key=${apiKey}`);

      if (response.data.coordinates) {
        onLocationSelected({
          latitude: response.data.coordinates.lat,
          longitude: response.data.coordinates.lng,
          address: response.data.nearestPlace,
        });

        toast.success(t('calls.what3words_found'));
      } else {
        toast.error(t('calls.what3words_not_found'));
      }
    } catch (error) {
      logger.error({ message: 'Error geocoding what3words', context: { error } });
      toast.error(t('calls.what3words_geocoding_error'));
    } finally {
      setIsGeocodingWhat3Words(false);
    }
  };

  /** Resolves a plus code to coordinates with the Google Maps Geocoding API. */
  const handlePlusCodeSearch = async (plusCode: string) => {
    if (!plusCode.trim()) {
      toast.warning(t('calls.plus_code_required'));
      return;
    }

    setIsGeocodingPlusCode(true);
    try {
      const apiKey = config?.GoogleMapsKey;

      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(plusCode)}&key=${apiKey}`);

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];

        onLocationSelected({
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
        });

        toast.success(t('calls.plus_code_found'));
      } else {
        toast.error(t('calls.plus_code_not_found'));
      }
    } catch (error) {
      logger.error({ message: 'Error geocoding plus code', context: { error } });
      toast.error(t('calls.plus_code_geocoding_error'));
    } finally {
      setIsGeocodingPlusCode(false);
    }
  };

  /**
   * Places typed coordinates ("40.7128, -74.0060") on the map and reverse geocodes them for an address.
   * The location is kept even when no address is found or the lookup fails.
   */
  const handleCoordinatesSearch = async (coordinates: string) => {
    if (!coordinates.trim()) {
      toast.warning(t('calls.coordinates_required'));
      return;
    }

    const coordRegex = /^(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/;
    const match = coordinates.trim().match(coordRegex);

    if (!match) {
      toast.warning(t('calls.coordinates_invalid_format'));
      return;
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      toast.warning(t('calls.coordinates_out_of_range'));
      return;
    }

    setIsGeocodingCoordinates(true);
    try {
      const apiKey = config?.GoogleMapsKey;

      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        onLocationSelected({
          latitude,
          longitude,
          address: response.data.results[0].formatted_address,
        });

        toast.success(t('calls.coordinates_found'));
      } else {
        onLocationSelected({ latitude, longitude, address: undefined });

        toast.info(t('calls.coordinates_no_address'));
      }
    } catch (error) {
      logger.error({ message: 'Error reverse geocoding coordinates', context: { error } });

      onLocationSelected({ latitude, longitude, address: undefined });

      toast.warning(t('calls.coordinates_geocoding_error'));
    } finally {
      setIsGeocodingCoordinates(false);
    }
  };

  return {
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
  };
};
