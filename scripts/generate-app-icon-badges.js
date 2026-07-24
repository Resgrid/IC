const { copyFileSync, mkdirSync, readFileSync, unlinkSync } = require('fs');
const { dirname } = require('path');

const { addBadge } = require('app-icon-badge');
const Jimp = require('jimp');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IMAGE_WRITE_TIMEOUT_MS = 30000;
const IMAGE_WRITE_POLL_INTERVAL_MS = 25;

function delay(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

async function waitForValidPng(imagePath) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < IMAGE_WRITE_TIMEOUT_MS) {
    try {
      const imageBuffer = readFileSync(imagePath);
      if (imageBuffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        const image = await Jimp.read(imagePath);
        if (image.bitmap.width > 0 && image.bitmap.height > 0) {
          return;
        }
      }
    } catch {
      // app-icon-badge does not await Jimp.writeAsync, so the file may not exist yet.
    }

    await delay(IMAGE_WRITE_POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for app icon badge image ${imagePath}`);
}

async function generateBadgeImage(job, badges) {
  const temporaryPath = `${job.outputPath}.${process.pid}.tmp.png`;
  mkdirSync(dirname(job.outputPath), { recursive: true });

  try {
    await addBadge({
      icon: job.sourcePath,
      dstPath: temporaryPath,
      badges,
      isAdaptiveIcon: job.isAdaptiveIcon,
    });
    await waitForValidPng(temporaryPath);
    copyFileSync(temporaryPath, job.outputPath);
    await waitForValidPng(job.outputPath);
  } finally {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // The temporary image is absent when generation fails before Jimp starts writing.
    }
  }
}

async function main() {
  const payload = JSON.parse(process.argv[2] ?? '{}');
  if (!Array.isArray(payload.jobs) || !Array.isArray(payload.badges)) {
    throw new Error('App icon badge generator requires jobs and badges arrays');
  }

  for (const job of payload.jobs) {
    await generateBadgeImage(job, payload.badges);
  }
}

main().catch((error) => {
  console.error('Failed to generate app icon badges:', error);
  process.exitCode = 1;
});
