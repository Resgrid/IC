import { act, renderHook } from '@testing-library/react-native';
import axios from 'axios';

import { useCallLocationSearch } from '@/hooks/use-call-location-search';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockToast = { show: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => mockToast,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

let mockConfig: { GoogleMapsKey?: string; W3WKey?: string } | null = { GoogleMapsKey: 'maps-key', W3WKey: 'w3w-key' };
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: (selector: (state: unknown) => unknown) => selector({ config: mockConfig }),
}));

const geocodeResult = (address: string, lat: number, lng: number) => ({ formatted_address: address, geometry: { location: { lat, lng } }, place_id: address });

const renderSearch = () => {
  const onLocationSelected = jest.fn();
  const { result } = renderHook(() => useCallLocationSearch({ onLocationSelected }));

  return { result, onLocationSelected };
};

describe('useCallLocationSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = { GoogleMapsKey: 'maps-key', W3WKey: 'w3w-key' };
  });

  it('selects a single address result directly', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'OK', results: [geocodeResult('12 Main St', 39.1, -119.7)] } });
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handleAddressSearch('12 Main St');
    });

    expect(onLocationSelected).toHaveBeenCalledWith({ latitude: 39.1, longitude: -119.7, address: '12 Main St' });
    expect(mockToast.success).toHaveBeenCalledWith('calls.address_found');
  });

  it('offers a choice when an address matches several places', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'OK', results: [geocodeResult('Main St, A', 1, 2), geocodeResult('Main St, B', 3, 4)] } });
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handleAddressSearch('Main St');
    });

    expect(onLocationSelected).not.toHaveBeenCalled();
    expect(result.current.showAddressSelection).toBe(true);
    expect(result.current.addressResults).toHaveLength(2);

    act(() => {
      result.current.handleAddressSelected(result.current.addressResults[1]);
    });

    expect(onLocationSelected).toHaveBeenCalledWith({ latitude: 3, longitude: 4, address: 'Main St, B' });
    expect(result.current.showAddressSelection).toBe(false);
  });

  it('reports a geocoding failure without selecting anything', async () => {
    mockConfig = { W3WKey: 'w3w-key' };
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handleAddressSearch('12 Main St');
    });

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(onLocationSelected).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith('calls.geocoding_error');
  });

  it('rejects a malformed what3words address before calling the API', async () => {
    const { result } = renderSearch();

    await act(async () => {
      await result.current.handleWhat3WordsSearch('not-three-words');
    });

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockToast.warning).toHaveBeenCalledWith('calls.what3words_invalid_format');
  });

  it('resolves a what3words address', async () => {
    mockedAxios.get.mockResolvedValue({ data: { coordinates: { lat: 51.52, lng: -0.19 }, nearestPlace: 'London', words: 'filled.count.soap' } });
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handleWhat3WordsSearch('filled.count.soap');
    });

    expect(onLocationSelected).toHaveBeenCalledWith({ latitude: 51.52, longitude: -0.19, address: 'London' });
    expect(mockToast.success).toHaveBeenCalledWith('calls.what3words_found');
  });

  it('resolves a plus code', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'OK', results: [geocodeResult('Somewhere', 10, 20)] } });
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handlePlusCodeSearch('849VCWC8+R9');
    });

    expect(onLocationSelected).toHaveBeenCalledWith({ latitude: 10, longitude: 20, address: 'Somewhere' });
    expect(mockToast.success).toHaveBeenCalledWith('calls.plus_code_found');
  });

  it('keeps typed coordinates even when reverse geocoding fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('offline'));
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handleCoordinatesSearch('40.7128, -74.0060');
    });

    expect(onLocationSelected).toHaveBeenCalledWith({ latitude: 40.7128, longitude: -74.006, address: undefined });
    expect(mockToast.warning).toHaveBeenCalledWith('calls.coordinates_geocoding_error');
  });

  it('rejects coordinates off the globe', async () => {
    const { result, onLocationSelected } = renderSearch();

    await act(async () => {
      await result.current.handleCoordinatesSearch('95, 10');
    });

    expect(onLocationSelected).not.toHaveBeenCalled();
    expect(mockToast.warning).toHaveBeenCalledWith('calls.coordinates_out_of_range');
  });
});
