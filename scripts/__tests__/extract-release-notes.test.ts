import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Forward slashes so the path survives bash on Windows (Git Bash accepts G:/... paths;
// backslashes would be eaten as escape characters). No-op on POSIX.
const scriptPath = path.join(process.cwd(), 'scripts/extract-release-notes.sh').replace(/\\/g, '/');

const extractReleaseNotes = (body: string): string => {
  const result = spawnSync('bash', [scriptPath, '--extract-only'], {
    encoding: 'utf8',
    input: body,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr);
  }

  return result.stdout.trim();
};

// Skip on Windows: `bash` resolves to WSL/Git Bash and the checked-out .sh file carries
// CRLF endings there ("set: pipefail: invalid option name"). CI runs this suite on Linux.
const describeOnPosix = process.platform === 'win32' ? describe.skip : describe;

describeOnPosix('extract-release-notes', () => {
  it.each(['##', '###'])('normalizes a %s PR Description heading', (heading) => {
    const notes = extractReleaseNotes(`${heading} PR Description\n\nAdds the release change.`);

    expect(notes).toBe(`${heading} Description\nAdds the release change.`);
    expect(notes).not.toContain('PR Description');
  });

  it('continues to prefer the dedicated Release Notes section', () => {
    const notes = extractReleaseNotes('## PR Description\nInternal PR context\n\n## Release Notes\nUser-facing change\n\n## Testing\nPassed');

    expect(notes).toBe('User-facing change');
  });
});
