import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) => React.createElement('View', { ...props, testID: `mock-${name}-icon` });
  return {
    AlertTriangle: icon('alert-triangle'),
    ClipboardList: icon('clipboard-list'),
    MapPin: icon('map-pin'),
    Phone: icon('phone'),
    Timer: icon('timer'),
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  return { Image: (props: any) => React.createElement('View', props) };
});

jest.mock('@/components/ui/html-renderer', () => ({
  HtmlRenderer: () => null,
}));

import { MAP_ICONS } from '@/constants/map-icons';
import { type CallResultData } from '@/models/v4/calls/callResultData';

import { CallCard } from '../call-card';

const baseCall = {
  CallId: '42',
  Number: '2026-42',
  Name: 'Structure fire',
  Nature: '',
  Address: '1 Main St',
  Priority: 0,
  LoggedOnUtc: '2026-10-21T10:00:00Z',
} as CallResultData;

const getTypeIcon = () => screen.getByTestId('call-card-type-icon-42', { includeHiddenElements: true });

describe('CallCard call type icon', () => {
  it('shows the uploaded call-type icon in place of the alert glyph', () => {
    const iconUrl = 'https://api.resgrid.dev/api/v4/TypeIcons/fire-key';
    render(<CallCard priority={undefined} call={{ ...baseCall, TypeIconUrl: iconUrl, TypeMapIcon: 'fire' } as CallResultData} />);

    expect(getTypeIcon().props.source).toEqual({ uri: iconUrl });
    expect(screen.queryByTestId('mock-alert-triangle-icon')).toBeNull();
  });

  it('uses the built-in call icon the type picked when nothing was uploaded', () => {
    render(<CallCard priority={undefined} call={{ ...baseCall, TypeIconUrl: null, TypeMapIcon: 'caraccident' } as CallResultData} />);

    expect(getTypeIcon().props.source).toBe(MAP_ICONS.caraccident.uri);
  });

  it('keeps the alert glyph when older servers omit the type icon fields', () => {
    render(<CallCard priority={undefined} call={baseCall} />);

    expect(screen.queryByTestId('call-card-type-icon-42', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('mock-alert-triangle-icon')).toBeTruthy();
  });
});
