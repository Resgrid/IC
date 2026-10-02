// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isSafeExternalUrl } = require('../external-links');

describe('isSafeExternalUrl', () => {
  it.each(['https://resgrid.com/help', 'http://example.com', 'HTTPS://EXAMPLE.COM/path?q=1'])('opens %s in the system browser', (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'resgridic://calls/42',
    'smb://attacker/share',
    'ms-msdt:/id PCWDiagnostic',
    'https:evil.example',
    ' https://leading-space.example',
    '',
  ])('refuses %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });

  it('refuses anything that is not a string', () => {
    expect(isSafeExternalUrl(undefined)).toBe(false);
    expect(isSafeExternalUrl({ toString: () => 'https://x' })).toBe(false);
  });
});
