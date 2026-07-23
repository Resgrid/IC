import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}));

const mockFetchDispatchData = jest.fn();
jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: (selector: (state: unknown) => unknown) =>
    selector({
      data: {
        units: [{ Id: '5', Type: 'Unit', Name: 'Engine 5', Selected: false }],
        users: [{ Id: 'u-9', Type: 'Personnel', Name: 'Jane Smith', Selected: false }],
        roles: [{ Id: '3', Type: 'Roles', Name: 'Driver', Selected: false }],
        groups: [{ Id: '7', Type: 'Groups', Name: 'Station 2', Selected: false }],
      },
      fetchDispatchData: mockFetchDispatchData,
    }),
}));

import { NeedEntityKind } from '@/models/v4/incidentCommand/incidentCommandModels';

import { NeedEntityPicker } from '../need-entity-picker';

describe('NeedEntityPicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads dispatch data and toggles selections across kinds', () => {
    const onChange = jest.fn();
    const { getByTestId, unmount } = render(<NeedEntityPicker selected={[]} onChange={onChange} />);

    expect(mockFetchDispatchData).toHaveBeenCalled();

    fireEvent.press(getByTestId(`need-entity-option-${NeedEntityKind.Unit}-5`));
    expect(onChange).toHaveBeenCalledWith([{ kind: NeedEntityKind.Unit, id: '5', name: 'Engine 5' }]);

    fireEvent.press(getByTestId(`need-entity-tab-${NeedEntityKind.Group}`));
    fireEvent.press(getByTestId(`need-entity-option-${NeedEntityKind.Group}-7`));
    expect(onChange).toHaveBeenLastCalledWith([{ kind: NeedEntityKind.Group, id: '7', name: 'Station 2' }]);

    unmount();
  });

  it('deselects an already-selected entity', () => {
    const onChange = jest.fn();
    const selected = [{ kind: NeedEntityKind.Unit, id: '5', name: 'Engine 5' }];
    const { getByTestId, unmount } = render(<NeedEntityPicker selected={selected} onChange={onChange} />);

    fireEvent.press(getByTestId(`need-entity-option-${NeedEntityKind.Unit}-5`));

    expect(onChange).toHaveBeenCalledWith([]);

    unmount();
  });
});
