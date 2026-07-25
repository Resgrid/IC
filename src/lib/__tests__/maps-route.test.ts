import { getMapsHeaderState } from '@/lib/maps-route';

describe('getMapsHeaderState', () => {
  it('shows the drawer menu on the Maps landing page', () => {
    expect(getMapsHeaderState('/maps')).toEqual({
      showMenu: true,
      titleKey: 'maps.title',
    });
    expect(getMapsHeaderState('/maps/')).toEqual({
      showMenu: true,
      titleKey: 'maps.title',
    });
  });

  it.each([
    ['/maps/search', 'maps.search_maps'],
    ['/maps/custom/custom-map-id', 'maps.custom_maps'],
    ['/maps/indoor/indoor-map-id', 'maps.indoor_maps'],
  ] as const)('shows a back button and the correct title for %s', (pathname, titleKey) => {
    expect(getMapsHeaderState(pathname)).toEqual({
      showMenu: false,
      titleKey,
    });
  });
});
