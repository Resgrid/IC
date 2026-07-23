import { sanitizeFileName } from '@/lib/utils';

describe('sanitizeFileName', () => {
  it('passes a plain file name through', () => {
    expect(sanitizeFileName('report.pdf')).toBe('report.pdf');
  });

  it('strips forward-slash path segments (traversal)', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('/absolute/path/report.pdf')).toBe('report.pdf');
  });

  it('strips backslash path segments', () => {
    expect(sanitizeFileName('..\\..\\windows\\evil.dll')).toBe('evil.dll');
  });

  it('removes residual traversal sequences from the basename (aggressively — every ".." pair)', () => {
    expect(sanitizeFileName('..secret..txt')).toBe('secrettxt');
  });

  it('falls back when the name reduces to nothing', () => {
    expect(sanitizeFileName('../..')).toBe('attachment');
    expect(sanitizeFileName('')).toBe('attachment');
    expect(sanitizeFileName(null)).toBe('attachment');
    expect(sanitizeFileName(undefined, 'file_42')).toBe('file_42');
  });
});
