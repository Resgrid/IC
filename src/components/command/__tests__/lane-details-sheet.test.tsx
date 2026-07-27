import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${Object.values(params).join('/')}` : key),
  }),
}));

import type { CommandStructureNode } from '@/models/v4/incidentCommand/incidentCommandModels';

import { LaneDetailsSheet } from '../lane-details-sheet';

const node = { CommandStructureNodeId: 'lane-1', Name: 'Division A', NodeType: 0, SortOrder: 0 } as CommandStructureNode;

const renderSheet = (props: Partial<React.ComponentProps<typeof LaneDetailsSheet>> = {}) => render(<LaneDetailsSheet isOpen node={node} objectives={[]} needs={[]} users={[]} onClose={jest.fn()} onSave={jest.fn()} {...props} />);

describe('LaneDetailsSheet delete flow', () => {
  it('hides the delete button when no onDelete handler is provided', () => {
    const { queryByTestId, unmount } = renderSheet();
    expect(queryByTestId('lane-details-delete')).toBeNull();
    unmount();
  });

  it('confirms an empty-lane delete directly', () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, unmount } = renderSheet({ onDelete, onClose, resourceCount: 0 });

    fireEvent.press(getByTestId('lane-details-delete'));
    expect(getByTestId('lane-delete-confirm')).toBeTruthy();

    fireEvent.press(getByTestId('lane-delete-confirm-button'));
    expect(onDelete).toHaveBeenCalledWith('lane-1', 'release');
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('offers move-to-pool or release when the lane has resources', () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText, unmount } = renderSheet({ onDelete, onClose, resourceCount: 3 });

    fireEvent.press(getByTestId('lane-details-delete'));
    expect(getByText('command.delete_lane_resources_message:3')).toBeTruthy();

    fireEvent.press(getByTestId('lane-delete-move-resources'));
    expect(onDelete).toHaveBeenCalledWith('lane-1', 'pool');
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('releases resources when that option is chosen', () => {
    const onDelete = jest.fn();
    const { getByTestId, unmount } = renderSheet({ onDelete, onClose: jest.fn(), resourceCount: 2 });

    fireEvent.press(getByTestId('lane-details-delete'));
    fireEvent.press(getByTestId('lane-delete-release-resources'));
    expect(onDelete).toHaveBeenCalledWith('lane-1', 'release');

    unmount();
  });

  it('cancel returns to the edit form without deleting', () => {
    const onDelete = jest.fn();
    const { getByTestId, queryByTestId, unmount } = renderSheet({ onDelete, resourceCount: 1 });

    fireEvent.press(getByTestId('lane-details-delete'));
    fireEvent.press(getByTestId('lane-delete-cancel'));

    expect(queryByTestId('lane-delete-confirm')).toBeNull();
    expect(getByTestId('lane-details-save')).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    unmount();
  });
});
