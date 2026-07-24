const { execFileSync } = require('child_process');
const { existsSync, statSync } = require('fs');
const { resolve } = require('path');

const GENERATED_DIRECTORY = '.expo/app-icon-badge';
const GENERATED_APP_ICON = `${GENERATED_DIRECTORY}/icon.png`;
const GENERATED_IOS_ICON = `${GENERATED_DIRECTORY}/ios-icon.png`;
const GENERATED_ADAPTIVE_ICON = `${GENERATED_DIRECTORY}/foregroundImage.png`;

function assertGeneratedImage(projectRoot, imagePath) {
  const absolutePath = resolve(projectRoot, imagePath);
  if (!existsSync(absolutePath) || statSync(absolutePath).size === 0) {
    throw new Error(`App icon badge generator did not create a valid image at ${imagePath}`);
  }
}

function withAppIconBadge(config, options = {}) {
  if (options.enabled === false) {
    return config;
  }

  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const jobs = [];

  if (config.icon) {
    jobs.push({
      sourcePath: resolve(projectRoot, config.icon),
      outputPath: resolve(projectRoot, GENERATED_APP_ICON),
      isAdaptiveIcon: false,
    });
  }

  if (config.ios?.icon) {
    jobs.push({
      sourcePath: resolve(projectRoot, config.ios.icon),
      outputPath: resolve(projectRoot, GENERATED_IOS_ICON),
      isAdaptiveIcon: false,
    });
  }

  if (config.android?.adaptiveIcon?.foregroundImage) {
    jobs.push({
      sourcePath: resolve(projectRoot, config.android.adaptiveIcon.foregroundImage),
      outputPath: resolve(projectRoot, GENERATED_ADAPTIVE_ICON),
      isAdaptiveIcon: true,
    });
  }

  if (jobs.length === 0) {
    return config;
  }

  const generatorPath = resolve(__dirname, '../scripts/generate-app-icon-badges.js');
  execFileSync(process.execPath, [generatorPath, JSON.stringify({ badges: options.badges ?? [], jobs })], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (config.icon) {
    assertGeneratedImage(projectRoot, GENERATED_APP_ICON);
    config.icon = GENERATED_APP_ICON;
  }

  if (config.ios?.icon) {
    assertGeneratedImage(projectRoot, GENERATED_IOS_ICON);
    config.ios.icon = GENERATED_IOS_ICON;
  }

  if (config.android?.adaptiveIcon?.foregroundImage) {
    assertGeneratedImage(projectRoot, GENERATED_ADAPTIVE_ICON);
    config.android.adaptiveIcon.foregroundImage = GENERATED_ADAPTIVE_ICON;
  }

  return config;
}

module.exports = withAppIconBadge;
