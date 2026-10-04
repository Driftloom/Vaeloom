/**
 * Tests for the shared documents feature helpers.
 *
 * Two classes of bug are pinned here, and both were live in the components this
 * module replaced:
 *
 *  1. **Runtime values that render as garbage.** `new Date('nonsense')` does not
 *     throw — `toLocaleDateString` returns the literal string "Invalid Date", so
 *     the `try/catch` wrapped around it could never fire. Every date test below
 *     asserts the exact placeholder instead.
 *  2. **Parsers that silently corrupt data.** The two hand-rolled CSV line
 *     parsers split on every comma, so `"Smith, John",42` came back as three
 *     fields, and they toggled their quote flag per `"` while dropping the
 *     character, so `"He said ""hi"""` came back as `He said hi`. Those exact
 *     cases are asserted.
 *
 * Locale is pinned with an explicit `locale` argument wherever an exact string is
 * asserted, because the default resolves to the host runtime's locale and these
 * tests must not depend on the machine that runs them.
 */

import {
  DEFAULT_CSV_DELIMITER,
  EMPTY,
  PLACEHOLDER,
  docWorkspaceId,
  extensionOf,
  formatBytes,
  formatDate,
  formatSize,
  getFileName,
  isInlinePreviewable,
  mimeForExtension,
  parseCsv,
  parseCsvLine,
  previewKind,
  scanStateOf,
} from '@/lib/document-format';

describe('getFileName', () => {
  it('returns the last segment of a nested path', () => {
    expect(getFileName('vault/notes/2026/q3-report.pdf')).toBe('q3-report.pdf');
    expect(getFileName('a/b/c/d.txt')).toBe('d.txt');
  });

  it('returns the whole string when there is no separator', () => {
    expect(getFileName('report.pdf')).toBe('report.pdf');
    expect(getFileName('.gitignore')).toBe('.gitignore');
  });

  it('skips trailing slashes instead of returning an empty name', () => {
    // `split('/').pop()` yields '' here, which renders as a blank row label.
    expect(getFileName('vault/notes/')).toBe('notes');
    expect(getFileName('vault//notes//')).toBe('notes');
    expect(getFileName('vault/')).toBe('vault');
  });

  it('returns an empty string for empty, root-only and absent input', () => {
    expect(getFileName('')).toBe('');
    expect(getFileName('/')).toBe('');
    expect(getFileName('///')).toBe('');
    expect(getFileName(undefined)).toBe('');
    expect(getFileName(null)).toBe('');
  });

  it('does not treat a backslash as a separator, because the backend stores /', () => {
    expect(getFileName('vault\\notes\\a.txt')).toBe('vault\\notes\\a.txt');
  });
});

describe('formatBytes', () => {
  it('renders sub-kilobyte sizes as whole bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('switches units exactly at the 1024 boundary', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('renders mebibytes and gibibytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
  });

  it('counts past GB rather than falling off the unit table', () => {
    expect(formatBytes(1024 ** 4)).toBe('1024.00 GB');
  });

  it('treats negative, absent, NaN and infinite input as no size', () => {
    // Each of these previously produced 'NaN B' or '-1 B' on screen.
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(-1024)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
    expect(formatBytes(Number.NEGATIVE_INFINITY)).toBe('0 B');
  });

  it('never emits NaN or Infinity in its output', () => {
    for (const input of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
      undefined,
      null,
      -42,
    ]) {
      expect(formatBytes(input)).not.toMatch(/NaN|Infinity/);
    }
  });

  it('honours a custom placeholder for an absent size', () => {
    expect(formatBytes(undefined, { empty: 'unknown' })).toBe('unknown');
    expect(formatBytes(0, { empty: 'unknown' })).toBe('unknown');
    expect(formatBytes(2048, { empty: 'unknown' })).toBe('2.0 KB');
  });

  it('rejects non-numeric input rather than coercing it', () => {
    // The component versions took `unknown` and ran `Number(...)` on it, which
    // turned a numeric string into a size and anything else into NaN.
    const result = formatBytes('1024' as unknown as number);
    expect(result).toBe('0 B');
    expect(result).not.toMatch(/NaN/);
  });
});

describe('formatSize', () => {
  it('is formatBytes with an em-dash placeholder for an absent size', () => {
    expect(formatSize(2048)).toBe(formatBytes(2048));
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(0)).toBe(PLACEHOLDER);
    expect(formatSize(undefined)).toBe(PLACEHOLDER);
    expect(formatSize(null)).toBe(PLACEHOLDER);
    expect(formatSize(-5)).toBe(PLACEHOLDER);
    expect(formatSize(Number.NaN)).toBe(PLACEHOLDER);
    expect(formatSize(Number.POSITIVE_INFINITY)).toBe(PLACEHOLDER);
  });

  it('does not render a dash for a real size', () => {
    expect(formatSize(1)).toBe('1 B');
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1024 ** 3)).toBe('1.00 GB');
  });

  it('exposes the same placeholder constant it renders', () => {
    expect(formatSize(undefined)).toBe(EMPTY);
    expect(EMPTY).toBe(PLACEHOLDER);
  });
});

describe('parseCsvLine', () => {
  it('keeps a delimiter inside a quoted field', () => {
    expect(parseCsvLine('"Smith, John",42')).toEqual(['Smith, John', '42']);
    expect(parseCsvLine('a,"b,c,d",e')).toEqual(['a', 'b,c,d', 'e']);
  });

  it('unescapes a doubled quote into one literal quote', () => {
    expect(parseCsvLine('"He said ""hi"""')).toEqual(['He said "hi"']);
    expect(parseCsvLine('"""quoted"""')).toEqual(['"quoted"']);
  });

  it('treats a quote away from the field start as data', () => {
    expect(parseCsvLine('5" nail,wood')).toEqual(['5" nail', 'wood']);
  });

  it('preserves whitespace inside quotes and trims it outside them', () => {
    expect(parseCsvLine('"  padded  ",b')).toEqual(['  padded  ', 'b']);
    expect(parseCsvLine('  a  ,  b  ')).toEqual(['a', 'b']);
  });

  it('reduces a whitespace-only unquoted field to an empty string', () => {
    expect(parseCsvLine('a,   ,b')).toEqual(['a', '', 'b']);
    expect(parseCsvLine('\t ,x')).toEqual(['', 'x']);
  });

  it('preserves empty fields between consecutive delimiters', () => {
    expect(parseCsvLine('a,,b')).toEqual(['a', '', 'b']);
    expect(parseCsvLine(',a')).toEqual(['', 'a']);
    expect(parseCsvLine('a,,,b')).toEqual(['a', '', '', 'b']);
    expect(parseCsvLine(',')).toEqual(['', '']);
  });

  it('returns a single empty field for empty and absent input', () => {
    expect(parseCsvLine('')).toEqual(['']);
    expect(parseCsvLine(undefined as unknown as string)).toEqual(['']);
  });

  it('keeps an unterminated quoted field leniently instead of throwing', () => {
    expect(parseCsvLine('"unterminated,still data')).toEqual(['unterminated,still data']);
  });

  it('handles a multi-character delimiter without splitting its parts', () => {
    expect(parseCsvLine('a||b', '||')).toEqual(['a', 'b']);
    expect(parseCsvLine('a|b', '||')).toEqual(['a|b']);
  });

  it('parses tab-separated records for TSV', () => {
    expect(parseCsvLine('a\tb,c', '\t')).toEqual(['a', 'b,c']);
  });

  it('defaults to a comma delimiter', () => {
    expect(DEFAULT_CSV_DELIMITER).toBe(',');
    expect(parseCsvLine('a,b')).toEqual(['a', 'b']);
  });
});

describe('parseCsv', () => {
  it('parses multiple rows into a grid of fields', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('includes the header row at index 0', () => {
    const rows = parseCsv('name,size\nreport.pdf,1024');
    expect(rows[0]).toEqual(['name', 'size']);
    expect(rows[1]).toEqual(['report.pdf', '1024']);
    expect(rows).toHaveLength(2);
  });

  it('keeps rows with differing column counts ragged instead of padding them', () => {
    const rows = parseCsv('a,b,c\n1,2\n3,4,5,6');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2'],
      ['3', '4', '5', '6'],
    ]);
    expect(rows[1]).toHaveLength(2);
  });

  it('keeps a newline inside a quoted field in the same record', () => {
    // A line-by-line split cannot express this: the record spans two lines.
    const rows = parseCsv('a,b\n"line one\nline two",2');
    expect(rows).toEqual([
      ['a', 'b'],
      ['line one\nline two', '2'],
    ]);
  });

  it('keeps a CRLF inside a quoted field', () => {
    expect(parseCsv('"x\r\ny",z')).toEqual([['x\r\ny', 'z']]);
  });

  it('accepts LF, CRLF and lone CR as record separators', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('unescapes doubled quotes across the whole document', () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([['a'], ['He said "hi"']]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('does not emit a trailing empty row for a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('a,b\n\n')).toEqual([['a', 'b']]);
  });

  it('strips a UTF-8 BOM from the first field', () => {
    expect(parseCsv('\ufeffid,name\n1,x')).toEqual([
      ['id', 'name'],
      ['1', 'x'],
    ]);
  });

  it('returns an empty grid for empty and absent input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(undefined)).toEqual([]);
    expect(parseCsv(null)).toEqual([]);
    expect(parseCsv('\n\n\n')).toEqual([]);
  });

  it('honours maxRows as an explicit budget rather than a silent truncation', () => {
    expect(parseCsv('1\n2\n3\n4', { maxRows: 2 })).toEqual([['1'], ['2']]);
    // Without the option the whole document is returned.
    expect(parseCsv('1\n2\n3\n4')).toHaveLength(4);
  });

  it('honours a tab delimiter for TSV', () => {
    expect(parseCsv('a\tb\n1\t2', { delimiter: '\t' })).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('treats a comma inside a quoted field as data, not a separator', () => {
    expect(parseCsv('name,note\n"Doe, Jane","said ""ok"""')).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'said "ok"'],
    ]);
  });
});

describe('formatDate', () => {
  it('formats a valid ISO timestamp as a localised date', () => {
    // Locale pinned: the default follows the host runtime.
    expect(formatDate('2026-09-30T10:00:00Z', { locale: 'en-US' })).toBe('Sep 30, 2026');
    expect(formatDate('2026-01-05', { locale: 'en-US' })).toBe('Jan 5, 2026');
  });

  it('accepts a Date and an epoch-milliseconds number', () => {
    expect(formatDate(new Date('2026-09-30T10:00:00Z'), { locale: 'en-US' })).toBe('Sep 30, 2026');
    expect(formatDate(Date.parse('2026-09-30T10:00:00Z'), { locale: 'en-US' })).toBe(
      'Sep 30, 2026',
    );
  });

  it('accepts an array of locales for a fallback chain', () => {
    expect(formatDate('2026-09-30T10:00:00Z', { locale: ['en-US'] })).toBe('Sep 30, 2026');
  });

  it('renders the placeholder for null, undefined and an empty string', () => {
    expect(formatDate(null)).toBe(PLACEHOLDER);
    expect(formatDate(undefined)).toBe(PLACEHOLDER);
    expect(formatDate('')).toBe(PLACEHOLDER);
    expect(formatDate('   ')).toBe(PLACEHOLDER);
  });

  it('renders the placeholder for unparseable input', () => {
    // Each of these produced the literal string "Invalid Date" on screen.
    expect(formatDate('not-a-date')).toBe(PLACEHOLDER);
    expect(formatDate('Invalid Date')).toBe(PLACEHOLDER);
    expect(formatDate('2026-13-45T99:99:99Z')).toBe(PLACEHOLDER);
    expect(formatDate(new Date('nope'))).toBe(PLACEHOLDER);
    expect(formatDate(Number.NaN)).toBe(PLACEHOLDER);
    expect(formatDate(Number.POSITIVE_INFINITY)).toBe(PLACEHOLDER);
  });

  it('never returns "Invalid Date" for any input', () => {
    const inputs = [
      null,
      undefined,
      '',
      '   ',
      'garbage',
      'Invalid Date',
      '2026-13-45',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      new Date('nope'),
      { not: 'a date' } as unknown as string,
    ];
    for (const input of inputs) {
      expect(formatDate(input)).not.toBe('Invalid Date');
    }
  });

  it('renders only the date, never a time component', () => {
    // Built with the local-time Date constructor on purpose: an ISO string is a
    // UTC instant, and the host timezone can put the two instants on different
    // local days, which would make this assert about the machine, not the code.
    const morning = formatDate(new Date(2026, 8, 30, 1, 0, 0), { locale: 'en-US' });
    const evening = formatDate(new Date(2026, 8, 30, 23, 0, 0), { locale: 'en-US' });
    expect(morning).toBe('Sep 30, 2026');
    expect(evening).toBe(morning);
    expect(morning).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('renders the host local date, so a late UTC instant can show the next day', () => {
    // Documented behaviour rather than a defect: toLocaleDateString formats in
    // the host timezone. Pinned as a shape assertion because which day it lands on
    // depends on the machine running the suite.
    const lateUtc = formatDate('2026-09-30T23:00:00Z', { locale: 'en-US' });
    expect(lateUtc).toMatch(/^(Sep 30|Oct 1), 2026$/);
    expect(lateUtc).not.toContain('Invalid');
  });
});

describe('scanStateOf', () => {
  it('maps every casing of CLEAN to clean', () => {
    expect(scanStateOf('CLEAN')).toBe('clean');
    expect(scanStateOf('clean')).toBe('clean');
    expect(scanStateOf('Clean')).toBe('clean');
    expect(scanStateOf('  cLeAn  ')).toBe('clean');
  });

  it('maps the rejection statuses to quarantined', () => {
    expect(scanStateOf('MALICIOUS')).toBe('quarantined');
    expect(scanStateOf('REJECTED')).toBe('quarantined');
    expect(scanStateOf('malicious')).toBe('quarantined');
    // The lowercase value the backend's own queries still compare against.
    expect(scanStateOf('QUARANTINED')).toBe('quarantined');
  });

  it('maps the in-flight statuses to scanning', () => {
    expect(scanStateOf('PENDING')).toBe('scanning');
    expect(scanStateOf('pending')).toBe('scanning');
    expect(scanStateOf('SCANNING')).toBe('scanning');
  });

  it('returns unknown for absent or unrecognised input', () => {
    expect(scanStateOf(undefined)).toBe('unknown');
    expect(scanStateOf(null)).toBe('unknown');
    expect(scanStateOf('')).toBe('unknown');
    expect(scanStateOf('garbage')).toBe('unknown');
    expect(scanStateOf('CLEANLY')).toBe('unknown');
    expect(scanStateOf(42 as unknown as string)).toBe('unknown');
  });
});

describe('extensionOf', () => {
  it('lower-cases the extension of a path or file name', () => {
    expect(extensionOf('vault/Q3-REPORT.PDF')).toBe('pdf');
    expect(extensionOf('a/b/c.tar.gz')).toBe('gz');
  });

  it('returns an empty string when there is no usable extension', () => {
    expect(extensionOf('README')).toBe('');
    expect(extensionOf('.gitignore')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
    expect(extensionOf('')).toBe('');
    expect(extensionOf(undefined)).toBe('');
  });
});

describe('mimeForExtension', () => {
  it('resolves the types a browser needs re-wrapping for', () => {
    expect(mimeForExtension('pdf')).toBe('application/pdf');
    expect(mimeForExtension('md')).toBe('text/markdown');
    expect(mimeForExtension('csv')).toBe('text/csv');
    expect(mimeForExtension('tsv')).toBe('text/tab-separated-values');
    expect(mimeForExtension('json')).toBe('application/json');
    expect(mimeForExtension('svg')).toBe('image/svg+xml');
    expect(mimeForExtension('jpg')).toBe('image/jpeg');
    expect(mimeForExtension('png')).toBe('image/png');
    expect(mimeForExtension('txt')).toBe('text/plain');
  });

  it('accepts a full path as well as a bare extension', () => {
    expect(mimeForExtension('vault/notes/a.csv')).toBe('text/csv');
    expect(mimeForExtension('.CSV')).toBe('text/csv');
  });

  it('returns null for an unknown extension so the caller keeps the blob type', () => {
    expect(mimeForExtension('exe')).toBeNull();
    expect(mimeForExtension('')).toBeNull();
    expect(mimeForExtension(undefined)).toBeNull();
  });
});

describe('previewKind', () => {
  it('classifies every supported category by extension', () => {
    expect(previewKind(null, 'md')).toBe('markdown');
    expect(previewKind(null, 'txt')).toBe('text');
    expect(previewKind(null, 'ts')).toBe('code');
    expect(previewKind(null, 'py')).toBe('code');
    expect(previewKind(null, 'json')).toBe('code');
    expect(previewKind(null, 'csv')).toBe('csv');
    expect(previewKind(null, 'tsv')).toBe('csv');
    expect(previewKind(null, 'pdf')).toBe('pdf');
    expect(previewKind(null, 'png')).toBe('image');
    expect(previewKind(null, 'svg')).toBe('image');
    expect(previewKind(null, 'mp4')).toBe('video');
    expect(previewKind(null, 'mp3')).toBe('audio');
  });

  it('classifies by the backend Document.type when there is no extension', () => {
    // These are the 13 values EXTENSION_MAP can emit, minus the binary formats.
    expect(previewKind(null, null, 'markdown')).toBe('markdown');
    expect(previewKind(null, null, 'text')).toBe('text');
    expect(previewKind(null, null, 'csv')).toBe('csv');
    expect(previewKind(null, null, 'json')).toBe('code');
    expect(previewKind(null, null, 'yaml')).toBe('code');
    expect(previewKind(null, null, 'html')).toBe('code');
    expect(previewKind(null, null, 'xml')).toBe('code');
    expect(previewKind(null, null, 'image')).toBe('image');
    expect(previewKind(null, null, 'pdf')).toBe('pdf');
    expect(previewKind(null, null, 'vault_note')).toBe('markdown');
  });

  it('falls back to the detected MIME type last', () => {
    // The branch DocumentsHub lost when it read `detected_mime_type`.
    expect(previewKind('text/markdown', null, 'unknown')).toBe('markdown');
    expect(previewKind('application/pdf', null, null)).toBe('pdf');
    expect(previewKind('image/png', null, null)).toBe('image');
    expect(previewKind('video/mp4', null, null)).toBe('video');
    expect(previewKind('audio/mpeg', null, null)).toBe('audio');
    expect(previewKind('text/csv; charset=utf-8', null, null)).toBe('csv');
  });

  it('lets the extension win over the MIME type', () => {
    expect(previewKind('application/octet-stream', 'csv', 'csv')).toBe('csv');
    expect(previewKind('text/plain', 'pdf', 'pdf')).toBe('pdf');
  });

  it('upgrades a plain-text verdict to markdown when the MIME says markdown', () => {
    expect(previewKind('text/markdown', 'txt', 'text')).toBe('markdown');
  });

  it('refuses the Office binary formats and other opaque containers', () => {
    expect(previewKind(null, 'docx')).toBe('none');
    expect(previewKind(null, 'xlsx')).toBe('none');
    expect(previewKind(null, 'pptx')).toBe('none');
    expect(previewKind(null, null, 'docx')).toBe('none');
    expect(previewKind(null, null, 'xlsx')).toBe('none');
    expect(previewKind(null, null, 'pptx')).toBe('none');
  });

  it('derives the extension from a path when only the path is known', () => {
    expect(previewKind(null, null, null, { path: 'a/b/report.csv' })).toBe('csv');
    expect(previewKind(null, null, null, { path: 'notes.md' })).toBe('markdown');
    expect(previewKind(null, null, null, { path: 'noextension' })).toBe('none');
  });

  it('returns none when every signal is missing or unusable', () => {
    expect(previewKind()).toBe('none');
    expect(previewKind(null, null, null)).toBe('none');
    expect(previewKind(undefined, undefined, undefined)).toBe('none');
    expect(previewKind('application/octet-stream', null, 'unknown')).toBe('none');
    expect(previewKind('', '', '')).toBe('none');
  });
});

describe('isInlinePreviewable', () => {
  it('accepts every previewable category', () => {
    expect(isInlinePreviewable(null, 'md')).toBe(true);
    expect(isInlinePreviewable(null, 'markdown')).toBe(true);
    expect(isInlinePreviewable(null, 'txt')).toBe(true);
    expect(isInlinePreviewable(null, 'json')).toBe(true);
    expect(isInlinePreviewable(null, 'csv')).toBe(true);
    expect(isInlinePreviewable(null, 'tsv')).toBe(true);
    expect(isInlinePreviewable(null, 'pdf')).toBe(true);
    expect(isInlinePreviewable(null, 'png')).toBe(true);
    expect(isInlinePreviewable(null, 'jpg')).toBe(true);
    expect(isInlinePreviewable(null, 'gif')).toBe(true);
    expect(isInlinePreviewable(null, 'svg')).toBe(true);
    expect(isInlinePreviewable(null, 'bmp')).toBe(true);
    expect(isInlinePreviewable(null, 'mp4')).toBe(true);
    expect(isInlinePreviewable(null, 'mp3')).toBe(true);
  });

  it('accepts a backend type on its own', () => {
    expect(isInlinePreviewable(null, null, 'markdown')).toBe(true);
    expect(isInlinePreviewable(null, null, 'image')).toBe(true);
    expect(isInlinePreviewable(null, null, 'pdf')).toBe(true);
  });

  it('accepts a MIME type on its own', () => {
    expect(isInlinePreviewable('text/markdown')).toBe(true);
    expect(isInlinePreviewable('application/pdf')).toBe(true);
    expect(isInlinePreviewable('image/webp')).toBe(true);
  });

  it('rejects an executable', () => {
    expect(isInlinePreviewable(null, 'exe')).toBe(false);
    expect(isInlinePreviewable(null, 'EXE')).toBe(false);
    expect(isInlinePreviewable('application/x-msdownload', 'exe', 'unknown')).toBe(false);
    expect(isInlinePreviewable(null, null, 'unknown')).toBe(false);
  });

  it('rejects binary Office formats and unknown types', () => {
    expect(isInlinePreviewable(null, 'docx')).toBe(false);
    expect(isInlinePreviewable(null, 'xlsx')).toBe(false);
    expect(isInlinePreviewable(null, 'pptx')).toBe(false);
    expect(isInlinePreviewable('application/octet-stream')).toBe(false);
  });

  it('rejects missing input without throwing', () => {
    expect(isInlinePreviewable()).toBe(false);
    expect(isInlinePreviewable(null, null, null)).toBe(false);
    expect(isInlinePreviewable(undefined, undefined, undefined)).toBe(false);
  });
});

describe('docWorkspaceId', () => {
  it('prefers the camelCase field, which is what transformKeys produces', () => {
    expect(docWorkspaceId({ workspaceId: 'ws-1' })).toBe('ws-1');
  });

  it('falls back to the snake_case field for hand-built objects', () => {
    expect(docWorkspaceId({ workspace_id: 'ws-legacy' })).toBe('ws-legacy');
    expect(docWorkspaceId({ workspaceId: '', workspace_id: 'ws-legacy' })).toBe('ws-legacy');
  });

  it('uses the supplied fallback before giving up', () => {
    expect(docWorkspaceId({}, 'ws-fallback')).toBe('ws-fallback');
    expect(docWorkspaceId({ workspaceId: 'ws-1' }, 'ws-fallback')).toBe('ws-1');
  });

  it('returns an empty string rather than undefined when there is nothing to use', () => {
    expect(docWorkspaceId({})).toBe('');
    expect(docWorkspaceId(null)).toBe('');
    expect(docWorkspaceId(undefined)).toBe('');
    expect(docWorkspaceId(null, null)).toBe('');
  });
});
