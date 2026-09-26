import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ServerUrlBottomSheet } from '../server-url-bottom-sheet';

const mockSetUrl = jest.fn().mockResolvedValue(undefined);
const mockGetUrl = jest.fn().mockResolvedValue('https://test.com/api/v4');
const mockGetSystemConfig = jest.fn();
const mockFormSetValue = jest.fn();
let mockFormValues: { url: string } = { url: 'https://test.com' };
let mockSelectOnValueChange: ((value: string) => void) | undefined;
const mockOnUrlChanged = jest.fn().mockResolvedValue(undefined);
const mockIsAuthenticated = jest.fn(() => false);

const SYSTEM_CONFIG = {
  Data: {
    Locations: [
      { Name: 'US-West', ApiUrl: 'https://api.resgrid.com', DisplayName: '', LocationInfo: '', IsDefault: true, AllowsFreeAccounts: true },
      { Name: 'EU-Central', ApiUrl: 'https://api.resgrid.eu/api/v4', DisplayName: '', LocationInfo: '', IsDefault: false, AllowsFreeAccounts: true },
    ],
  },
};

jest.mock('@/api/config', () => ({
  getSystemConfig: () => mockGetSystemConfig(),
}));

jest.mock('@/hooks/use-keyboard-height', () => ({ useKeyboardHeight: () => 0 }));
jest.mock('lucide-react-native', () => ({ ChevronDownIcon: () => null }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.server_url': 'Server URL',
        'settings.server': 'Server',
        'settings.custom': 'Custom',
        'settings.enter_server_url': 'Enter Resgrid API URL',
        'settings.server_url_note': 'Note: This is the URL of the Resgrid API',
        'loading.loadingData': 'Loading data...',
        'form.required': 'This field is required',
        'form.invalid_url': 'Please enter a valid URL',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('react-hook-form', () => ({
  useForm: () => {
    const React = require('react');
    const [, forceRender] = React.useState(0);

    // Stable like the real react-hook-form setValue, so it does not re-trigger effects that depend on it.
    const setValue = React.useCallback((name: 'url', value: string) => {
      mockFormValues = { ...mockFormValues, [name]: value };
      mockFormSetValue(name, value);
      forceRender((current: number) => current + 1);
    }, []);

    return {
      control: {},
      handleSubmit: (fn: (data: { url: string }) => unknown) => () => fn({ ...mockFormValues }),
      setValue,
      setError: jest.fn(),
      formState: { errors: {} },
    };
  },
  Controller: ({ name, render }: any) =>
    render({
      field: {
        onChange: (value: string) => {
          mockFormValues = { ...mockFormValues, [name]: value };
        },
        value: mockFormValues[name as keyof typeof mockFormValues] ?? '',
      },
    }),
}));

jest.mock('@/stores/app/server-url-store', () => ({
  useServerUrlStore: (selector: (state: { getUrl: typeof mockGetUrl; setUrl: typeof mockSetUrl }) => unknown) => selector({ getUrl: mockGetUrl, setUrl: mockSetUrl }),
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: (selector: (state: { isAuthenticated: () => boolean }) => boolean) => selector({ isAuthenticated: mockIsAuthenticated }),
}));

jest.mock('@/lib/env', () => ({
  Env: { API_VERSION: 'v4' },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../ui/actionsheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Actionsheet: ({ children, isOpen }: any) => (isOpen ? React.createElement(View, { testID: 'actionsheet' }, children) : null),
    ActionsheetBackdrop: ({ children }: any) => React.createElement(View, {}, children),
    ActionsheetContent: ({ children }: any) => React.createElement(View, {}, children),
    ActionsheetDragIndicator: () => React.createElement(View, {}),
    ActionsheetDragIndicatorWrapper: ({ children }: any) => React.createElement(View, {}, children),
  };
});

jest.mock('../../ui/button', () => {
  const React = require('react');
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => React.createElement(TouchableOpacity, { testID: 'button', onPress }, children),
    ButtonText: ({ children }: any) => React.createElement(Text, {}, children),
    ButtonSpinner: () => React.createElement(View, { testID: 'button-spinner' }),
  };
});

jest.mock('../../ui/form-control', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    FormControl: ({ children }: any) => React.createElement(View, {}, children),
    FormControlLabel: ({ children }: any) => React.createElement(View, {}, children),
    FormControlLabelText: ({ children }: any) => React.createElement(Text, {}, children),
    FormControlHelperText: ({ children }: any) => React.createElement(View, {}, children),
    FormControlError: ({ children }: any) => React.createElement(View, {}, children),
    FormControlErrorText: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('../../ui/center', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Center: ({ children, testID }: any) => React.createElement(View, { testID }, children),
  };
});

jest.mock('../../ui/hstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    HStack: ({ children }: any) => React.createElement(View, {}, children),
  };
});

jest.mock('../../ui/input', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');
  return {
    Input: ({ children }: any) => React.createElement(View, {}, children),
    InputField: (props: any) => React.createElement(TextInput, { testID: 'input-field', ...props }),
  };
});

jest.mock('../../ui/select', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    Select: ({ children, onValueChange }: any) => {
      mockSelectOnValueChange = onValueChange;
      return React.createElement(View, { testID: 'server-select' }, children);
    },
    SelectBackdrop: ({ children }: any) => React.createElement(View, {}, children),
    SelectContent: ({ children }: any) => React.createElement(View, {}, children),
    SelectDragIndicator: () => React.createElement(View, {}),
    SelectDragIndicatorWrapper: ({ children }: any) => React.createElement(View, {}, children),
    SelectIcon: () => React.createElement(View, {}),
    SelectInput: ({ value, placeholder }: any) => React.createElement(Text, { testID: 'select-input' }, value || placeholder),
    SelectItem: ({ label, value }: any) => React.createElement(TouchableOpacity, { testID: `select-item-${value}`, onPress: () => mockSelectOnValueChange?.(value) }, React.createElement(Text, {}, label)),
    SelectPortal: ({ children }: any) => React.createElement(View, {}, children),
    SelectTrigger: ({ children }: any) => React.createElement(View, {}, children),
  };
});

jest.mock('../../ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Text: ({ children }: any) => React.createElement(Text, {}, children),
  };
});

jest.mock('../../ui/vstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    VStack: ({ children }: any) => React.createElement(View, {}, children),
  };
});

describe('ServerUrlBottomSheet', () => {
  const mockOnClose = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onUrlChanged: mockOnUrlChanged,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUrl.mockResolvedValue('https://test.com/api/v4');
    mockGetSystemConfig.mockResolvedValue(SYSTEM_CONFIG);
    mockIsAuthenticated.mockReturnValue(false);
    mockFormValues = { url: 'https://test.com' };
    mockSelectOnValueChange = undefined;
  });

  describe('rendering', () => {
    it('does not render when closed', () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('actionsheet')).toBeNull();
      expect(mockGetSystemConfig).not.toHaveBeenCalled();
      unmount();
    });

    it('shows a loading state while server options load', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      expect(screen.getByTestId('server-options-loading')).toBeTruthy();
      expect(screen.getByText('Loading data...')).toBeTruthy();

      await waitFor(() => {
        expect(screen.queryByTestId('server-options-loading')).toBeNull();
      });
      unmount();
    });

    it('lists every system config location plus a Custom option', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-item-US-West')).toBeTruthy();
      });

      expect(screen.getByTestId('select-item-EU-Central')).toBeTruthy();
      expect(screen.getByTestId('select-item-__custom__')).toBeTruthy();
      unmount();
    });
  });

  describe('initial selection', () => {
    it('selects Custom and shows the stored url when it matches no location', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('Custom');
      });

      expect(screen.getByTestId('input-field').props.value).toBe('https://test.com');
      expect(screen.getByTestId('input-field').props.editable).toBe(true);
      unmount();
    });

    it('keeps a self-hosted sub-path when showing a custom url', async () => {
      mockGetUrl.mockResolvedValue('https://example.org/resgrid/api/v4/');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('input-field').props.value).toBe('https://example.org/resgrid');
      });
      unmount();
    });

    it('selects the matching location and locks the text input', async () => {
      mockGetUrl.mockResolvedValue('https://api.resgrid.eu/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('EU-Central');
      });

      expect(screen.getByTestId('input-field').props.editable).toBe(false);
      unmount();
    });

    it('matches a location whose ApiUrl omits the api suffix', async () => {
      mockGetUrl.mockResolvedValue('https://api.resgrid.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
      });
      unmount();
    });

    it('falls back to Custom when system config cannot be loaded', async () => {
      mockGetSystemConfig.mockRejectedValue(new Error('Network Error'));

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('Custom');
      });

      expect(screen.queryByTestId('select-item-US-West')).toBeNull();
      expect(screen.getByTestId('input-field').props.value).toBe('https://test.com');
      unmount();
    });
  });

  describe('changing the selection', () => {
    it('fills the text box with the selected location ApiUrl', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-item-US-West')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('select-item-US-West'));

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
        expect(screen.getByTestId('input-field').props.value).toBe('https://api.resgrid.com');
      });
      unmount();
    });

    it('re-enables the text input when Custom is selected', async () => {
      mockGetUrl.mockResolvedValue('https://api.resgrid.com/api/v4');

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('US-West');
      });

      fireEvent.press(screen.getByTestId('select-item-__custom__'));

      await waitFor(() => {
        expect(screen.getByTestId('select-input').props.children).toBe('Custom');
      });

      expect(screen.getByTestId('input-field').props.editable).toBe(true);
      unmount();
    });
  });

  describe('saving', () => {
    it('saves a custom url with the api suffix', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('server-options-loading')).toBeNull();
      });

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSetUrl).toHaveBeenCalledWith('https://test.com/api/v4');
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnUrlChanged).not.toHaveBeenCalled();
      unmount();
    });

    it('saves the selected location ApiUrl without doubling the api suffix', async () => {
      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-item-EU-Central')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('select-item-EU-Central'));
      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSetUrl).toHaveBeenCalledWith('https://api.resgrid.eu/api/v4');
      });
      unmount();
    });

    it('signs out through the callback after saving while authenticated', async () => {
      mockIsAuthenticated.mockReturnValue(true);

      const { unmount } = render(<ServerUrlBottomSheet {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByTestId('server-options-loading')).toBeNull();
      });

      fireEvent.press(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnUrlChanged).toHaveBeenCalledTimes(1);
      });

      expect(mockSetUrl).toHaveBeenCalledWith('https://test.com/api/v4');
      unmount();
    });
  });
});
