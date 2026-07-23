import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  return {
    Globe: (props: any) => React.createElement('View', { ...props, testID: 'mock-globe-icon' }),
    Lock: (props: any) => React.createElement('View', { ...props, testID: 'mock-lock-icon' }),
  };
});

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => (isOpen ? children : null),
}));

jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  getTimeAgoUtc: jest.fn(() => '5 minutes ago'),
}));

import { IncidentContentVisibility, type IncidentNote } from '@/models/v4/incidentCommand/incidentCommandModels';

import { NotesSection } from '../notes-section';

const notes = [
  {
    IncidentNoteId: 'note-1',
    IncidentCommandId: 'ic-1',
    DepartmentId: 1,
    CallId: 5,
    NoteType: 0,
    Visibility: IncidentContentVisibility.Internal,
    Title: 'Water supply',
    Body: 'Hydrant on the corner is dead',
    CreatedByUserId: 'u1',
    CreatedOn: '2026-07-01T10:00:00Z',
  },
] as unknown as IncidentNote[];

describe('NotesSection', () => {
  it('renders notes with their visibility badge', () => {
    const { getByText, getByTestId, unmount } = render(<NotesSection notes={notes} onAdd={jest.fn()} />);

    expect(getByText('Water supply')).toBeTruthy();
    expect(getByText('Hydrant on the corner is dead')).toBeTruthy();
    expect(getByTestId('note-note-1')).toBeTruthy();
    expect(getByText('command.note_internal')).toBeTruthy();

    unmount();
  });

  it('adds a note with the selected visibility', () => {
    const onAdd = jest.fn();
    const { getByTestId, unmount } = render(<NotesSection notes={[]} onAdd={onAdd} />);

    fireEvent.press(getByTestId('command-notes-add'));
    fireEvent.changeText(getByTestId('command-note-input'), 'Second alarm requested');
    fireEvent.press(getByTestId('command-note-visibility-public'));
    fireEvent.press(getByTestId('command-note-save'));

    expect(onAdd).toHaveBeenCalledWith('Second alarm requested', IncidentContentVisibility.Public);

    unmount();
  });

  it('defaults new notes to internal visibility', () => {
    const onAdd = jest.fn();
    const { getByTestId, unmount } = render(<NotesSection notes={[]} onAdd={onAdd} />);

    fireEvent.press(getByTestId('command-notes-add'));
    fireEvent.changeText(getByTestId('command-note-input'), 'Crew rotation at 30'); // no visibility tap
    fireEvent.press(getByTestId('command-note-save'));

    expect(onAdd).toHaveBeenCalledWith('Crew rotation at 30', IncidentContentVisibility.Internal);

    unmount();
  });

  it('hides the add button when read-only (no onAdd)', () => {
    const { queryByTestId, unmount } = render(<NotesSection notes={notes} />);

    expect(queryByTestId('command-notes-add')).toBeNull();

    unmount();
  });
});
