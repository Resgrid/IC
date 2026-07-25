export type MapsHeaderTitleKey = 'maps.custom_maps' | 'maps.indoor_maps' | 'maps.search_maps' | 'maps.title';

interface MapsHeaderState {
  showMenu: boolean;
  titleKey: MapsHeaderTitleKey;
}

export const getMapsHeaderState = (pathname: string): MapsHeaderState => {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPathname === '/maps') {
    return {
      showMenu: true,
      titleKey: 'maps.title',
    };
  }

  if (normalizedPathname.startsWith('/maps/search')) {
    return {
      showMenu: false,
      titleKey: 'maps.search_maps',
    };
  }

  if (normalizedPathname.startsWith('/maps/custom/')) {
    return {
      showMenu: false,
      titleKey: 'maps.custom_maps',
    };
  }

  if (normalizedPathname.startsWith('/maps/indoor/')) {
    return {
      showMenu: false,
      titleKey: 'maps.indoor_maps',
    };
  }

  return {
    showMenu: false,
    titleKey: 'maps.title',
  };
};
