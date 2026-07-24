import type { AppIconBadgeConfig } from 'app-icon-badge/types';

const mockExecFileSync = jest.fn();
const mockExistsSync = jest.fn(() => true);
const mockStatSync = jest.fn(() => ({ size: 100 }));

jest.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
}));

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
}));

interface TestExpoConfig {
  _internal?: {
    projectRoot?: string;
  };
  android?: {
    adaptiveIcon?: {
      foregroundImage?: string;
    };
  };
  icon?: string;
  ios?: {
    icon?: string;
  };
}

const withAppIconBadge = jest.requireActual('../with-app-icon-badge.js') as (config: TestExpoConfig, options?: AppIconBadgeConfig) => TestExpoConfig;

describe('withAppIconBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates all configured icons before rewriting their config paths', () => {
    const config: TestExpoConfig = {
      _internal: { projectRoot: '/project' },
      icon: './assets/icon.png',
      ios: { icon: './assets/ios-icon.png' },
      android: { adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png' } },
    };
    const options: AppIconBadgeConfig = {
      enabled: true,
      badges: [{ type: 'banner', text: 'development' }],
    };

    const result = withAppIconBadge(config, options);

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    const generatorArguments = mockExecFileSync.mock.calls[0]?.[1] as string[];
    const payload = JSON.parse(generatorArguments[1] ?? '{}') as {
      jobs: { isAdaptiveIcon: boolean; outputPath: string; sourcePath: string }[];
    };
    expect(payload.jobs).toEqual([
      {
        sourcePath: '/project/assets/icon.png',
        outputPath: '/project/.expo/app-icon-badge/icon.png',
        isAdaptiveIcon: false,
      },
      {
        sourcePath: '/project/assets/ios-icon.png',
        outputPath: '/project/.expo/app-icon-badge/ios-icon.png',
        isAdaptiveIcon: false,
      },
      {
        sourcePath: '/project/assets/adaptive-icon.png',
        outputPath: '/project/.expo/app-icon-badge/foregroundImage.png',
        isAdaptiveIcon: true,
      },
    ]);
    expect(result.icon).toBe('.expo/app-icon-badge/icon.png');
    expect(result.ios?.icon).toBe('.expo/app-icon-badge/ios-icon.png');
    expect(result.android?.adaptiveIcon?.foregroundImage).toBe('.expo/app-icon-badge/foregroundImage.png');
  });

  it('leaves icon paths untouched when badges are disabled', () => {
    const config: TestExpoConfig = {
      _internal: { projectRoot: '/project' },
      icon: './assets/icon.png',
      android: { adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png' } },
    };

    const result = withAppIconBadge(config, { enabled: false, badges: [] });

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(result.icon).toBe('./assets/icon.png');
    expect(result.android?.adaptiveIcon?.foregroundImage).toBe('./assets/adaptive-icon.png');
  });
});
