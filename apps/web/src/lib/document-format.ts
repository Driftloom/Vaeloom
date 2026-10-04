/**
 * Shared formatting and classification helpers for the documents feature.
 *
 * WHY THIS MODULE EXISTS
 *
 * Every helper below was copy-pasted into two to five components, and the copies
 * had already drifted: two different byte formatters with different zero
 * placeholders and different unit ceilings, four copies of `getFileName` that all
 * mishandle a trailing slash, two hand-rolled CSV parsers that silently corrupt
 * any quoted field containing the delimiter or a doubled quote, and one
 * `formatDate` that renders the literal string "Invalid Date" because
 * `new Date('garbage').toLocaleDateString()` does not throw — it returns
 * "Invalid Date", so the `try/catch` around it could never fire.
 *
 * Two invariants hold for every export:
 *
 *  1. No input throws. `null`, `undefined`, `NaN`, `Infinity`, `''`, and garbage
 *     strings all return a safe value.
 *  2. No input ever produces the string "Invalid Date" or "NaN" in the output.
 *
 * Import from here rather than re-declaring a local copy. Nothing in this module
 * imports React or touches the DOM, so it is usable from server components and
 * from tests as-is.
 */

/** Rendered in place of a value that is absent, unparseable or out of range. */
export const PLACEHOLDER = '—';

/** Returned when a value is absent. Aliased so call sites read as intent. */
export const EMPTY = PLACEHOLDER;

// ─── Paths ───────────────────────────────────────────────────────────────────

/**
 * The file name of a document path: everything after the final `/`.
 *
 * Accepts a POSIX-style document path as stored in `Document.path`
 * (`schemas/document.py:12`). Backslashes are NOT treated as separators, because
 * the backend stores `/` on every platform.
 *
 * Trailing slashes are tolerated: `"vault/notes/"` yields `"notes"` rather than
 * the empty string, which is what a naive `split('/').pop()` gives you. That
 * matters because a folder-shaped path would otherwise render as a blank name.
 *
 * @returns The last non-empty path segment. `''` for `''`, `'/'`, `'///'`,
 * `null` and `undefined` — never `undefined`, so the result is always safe to
 * render or call `.split()` on.
 */
export function getFileName(path: string | null | undefined): string {
  if (typeof path !== 'string' || path.length === 0) return '';
  const segments = path.split('/').filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? '';
}

// ─── Byte sizes ──────────────────────────────────────────────────────────────

/** Options for {@link formatBytes}. */
export interface FormatBytesOptions {
  /**
   * Rendered when the input is absent, non-finite, or not positive.
   * Defaults to `'0 B'`, which is what a file listing wants: zero bytes is a
   * real answer, not missing data.
   */
  empty?: string;
}

/**
 * Human-readable byte count, base-1024, using the largest unit that keeps the
 * mantissa at or above 1.
 *
 * This is the CANONICAL byte formatter. `DocumentUploadQueue.formatBytes` and
 * `DocumentStatsBar.formatBytes` were the same function with different ceilings;
 * this one supersedes both, and {@link formatSize} is kept as a thin wrapper for
 * the components that render an em dash for an unknown size.
 *
 * Units and precision: `B` (integer), `KB` and `MB` (one decimal), `GB` (two
 * decimals). Beyond `GB` the value keeps counting up in GB, so a 4 TB file reads
 * as `4096.00 GB` rather than overflowing to a unit this function does not know.
 *
 * @param bytes A byte count. `null`, `undefined`, `NaN`, `Infinity` and
 * negative values are all treated as "no size".
 * @returns A short label such as `'0 B'`, `'1023 B'`, `'1.0 KB'`, `'1.00 GB'`,
 * or `options.empty` when the input is not a usable size. Never throws, never
 * returns a string containing `NaN` or `Infinity`.
 */
export function formatBytes(
  bytes: number | null | undefined,
  options: FormatBytesOptions = {},
): string {
  const empty = options.empty ?? '0 B';
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return empty;

  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes < KB) return `${Math.floor(bytes)} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/**
 * Alias of {@link formatBytes} that renders {@link PLACEHOLDER} instead of
 * `'0 B'` for an absent size.
 *
 * Kept because `DocumentsHub` and `DocumentDetailView` both render an em dash
 * for a document whose size is unknown, and collapsing that to `'0 B'` would be
 * a silent, unrequested visual change in two components. The arithmetic lives in
 * exactly one place; this only swaps the placeholder.
 *
 * @returns `'—'` for a non-positive, non-finite or absent size; otherwise the
 * same label {@link formatBytes} would return.
 */
export function formatSize(bytes: number | null | undefined): string {
  return formatBytes(bytes, { empty: PLACEHOLDER });
}

// ─── Workspace identity ──────────────────────────────────────────────────────

/** The subset of a document these helpers need. Structural, so either shape fits. */
export interface WorkspaceScoped {
  workspaceId?: string | null;
}

/**
 * The workspace a document belongs to, for code that must build a per-document
 * URL.
 *
 * Reads the camelCase `workspaceId`, which is what `transformKeys` produces for
 * every `documentApi` response. There is deliberately no snake_case fallback:
 * a hand-constructed fixture that spells it `workspace_id` is a bug in the
 * fixture, and papering over it here is how that bug reaches production.
 *
 * @param doc The document. `null`/`undefined` is accepted.
 * @param fallbackWorkspaceId Used when the document does not carry an id.
 * @returns A workspace id, or `''` when neither the document nor the fallback
 * has one. Never returns `undefined`, so it is always safe to interpolate into a
 * URL or compare against another id.
 */
export function docWorkspaceId(
  doc: WorkspaceScoped | null | undefined,
  fallbackWorkspaceId?: string | null,
): string {
  const camel = doc?.workspaceId;
  if (typeof camel === 'string' && camel.length > 0) return camel;
  return fallbackWorkspaceId ?? '';
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** Anything {@link formatDate} will attempt to parse. */
export type DateInput = string | number | Date | null | undefined;

/** Options for {@link formatDate}. */
export interface FormatDateOptions {
  /**
   * BCP-47 locale tag(s) for `toLocaleDateString`. Defaults to `undefined`, i.e.
   * the host runtime's locale.
   *
   * This default is deliberate. Nine call sites formatted dates; exactly one
   * pinned `'en-US'` and the rest used the host locale, so the same document
   * rendered `Sep 30, 2026` in the table and `30/09/2026` in the detail header.
   * A localised product should not hardcode one locale in one component — pass
   * `{ locale: 'en-US' }` explicitly if a specific locale is genuinely wanted.
   */
  locale?: string | string[];
  /** Defaults to `{ month: 'short', day: 'numeric', year: 'numeric' }`. */
  options?: Intl.DateTimeFormatOptions;
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

/**
 * A calendar date, or {@link PLACEHOLDER} when there is nothing valid to show.
 *
 * Only the DATE is rendered. `createdAt` and `updatedAt` are stored with a time
 * component, and no document surface in this app displays a timestamp, so a time
 * would be noise that also makes two same-day rows look different.
 *
 * The rendered date is the HOST LOCAL date, not the UTC date. A row created at
 * `2026-09-30T23:00:00Z` displays as `Oct 1, 2026` anywhere west of UTC. That is
 * the correct behaviour for a user-facing timestamp and is what every other
 * `toLocaleDateString` call in the app already does; it is called out because it
 * makes naive assertions on UTC fixtures fail on a machine that is not set to
 * UTC. Build fixtures with the local-time `Date` constructor
 * (`new Date(2026, 8, 30)`) rather than an ISO string when asserting on output.
 *
 * NEVER returns `"Invalid Date"`. That string comes from
 * `Date.prototype.toLocaleDateString` on a `Date` whose time value is `NaN`, and
 * it is produced WITHOUT throwing — so the `try/catch` that used to wrap these
 * calls could not catch it. The `Number.isNaN(getTime())` check below is what
 * actually prevents it, and it also catches out-of-range numbers and Date
 * objects constructed from an invalid string.
 *
 * @param iso An ISO-8601 string, a epoch-milliseconds number, or a `Date`.
 * `null`, `undefined`, `''` and unparseable values yield {@link PLACEHOLDER}.
 * @returns A localised date such as `'Sep 30, 2026'`, or {@link PLACEHOLDER}.
 * Never throws.
 */
export function formatDate(
  iso: DateInput,
  { locale, options = DEFAULT_DATE_OPTIONS }: FormatDateOptions = {},
): string {
  if (iso === null || iso === undefined || iso === '') return PLACEHOLDER;

  let date: Date;
  if (iso instanceof Date) {
    date = iso;
  } else if (typeof iso === 'number') {
    if (!Number.isFinite(iso)) return PLACEHOLDER;
    date = new Date(iso);
  } else if (typeof iso === 'string') {
    const trimmed = iso.trim();
    if (trimmed.length === 0) return PLACEHOLDER;
    date = new Date(trimmed);
  } else {
    return PLACEHOLDER;
  }

  // The check that the old try/catch was meant to be.
  if (Number.isNaN(date.getTime())) return PLACEHOLDER;

  try {
    const formatted = date.toLocaleDateString(locale, options);
    // Belt and braces: a runtime that cannot resolve the locale or the options
    // can still hand back "Invalid Date" rather than throwing.
    return formatted === 'Invalid Date' ? PLACEHOLDER : formatted;
  } catch {
    return PLACEHOLDER;
  }
}

// ─── Security scan state ─────────────────────────────────────────────────────

/** UI-level state derived from `Document.scan_status`. */
export type ScanState = 'clean' | 'quarantined' | 'scanning' | 'unknown';

/**
 * Map a backend `scan_status` onto the state a badge should render.
 *
 * Case-insensitive, and that is not defensive padding. The API is typed
 * `str` (`schemas/document.py:16`) and the column default is `'CLEAN'`
 * (`models/schema.py:357`), but rows written before the uppercase migration
 * still hold lowercase values — the backend's own queries compare against
 * lowercase `'quarantined'` (`tools/executor.py:437,489`) — and fixtures in this
 * repo use lowercase `'clean'`. A `===` comparison against `'CLEAN'` therefore
 * silently classified real documents as `unknown` and dropped their badge.
 *
 * Accepted inputs: `'CLEAN'`/`'clean'`/`'Clean'` -> `clean`;
 * `'MALICIOUS'`, `'REJECTED'`, and the legacy `'QUARANTINED'` -> `quarantined`;
 * `'PENDING'` (a client-side in-flight state, never served) and `'SCANNING'` ->
 * `scanning`. Anything else, including `undefined`, is `unknown`.
 *
 * @param status The raw `scan_status` value.
 * @returns One of {@link ScanState}. Never throws, whatever is passed in.
 */
export function scanStateOf(status: string | null | undefined): ScanState {
  if (typeof status !== 'string') return 'unknown';
  switch (status.trim().toUpperCase()) {
    case 'CLEAN':
      return 'clean';
    case 'MALICIOUS':
    case 'REJECTED':
    case 'QUARANTINED':
      return 'quarantined';
    case 'PENDING':
    case 'SCANNING':
      return 'scanning';
    default:
      return 'unknown';
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** Default field delimiter. Pass `'\\t'` for TSV. */
export const DEFAULT_CSV_DELIMITER = ',';

/**
 * Split one CSV record into its fields.
 *
 * Correct on the two cases the hand-rolled parsers in `DocumentDetailView` and
 * `DocumentPreviewModal` got wrong:
 *
 *  - A quoted field may CONTAIN the delimiter: `"Smith, John",42` is two fields,
 *    not three. The naive parsers split on every comma and produced three.
 *  - A doubled quote inside a quoted field is a literal quote:
 *    `"He said ""hi"""` is `He said "hi"`. The naive parsers toggled
 *    `inQuotes` on each `"` and dropped both characters, yielding `He said hi`.
 *
 * A `"` only opens or closes a field when it is the first character of that
 * field; anywhere else it is literal data, which is what keeps `5" nail` intact.
 *
 * A quoted field is preserved VERBATIM — no trimming — because leading and
 * trailing spaces can be significant inside quotes. An unquoted field is trimmed,
 * so a whitespace-only unquoted field becomes `''`.
 *
 * An unterminated quote is treated leniently: the rest of the line becomes the
 * field. This never throws and never drops data.
 *
 * NOTE: a quoted field spanning a NEWLINE is not handled here, because a single
 * record cannot contain one. Use {@link parseCsv} for whole-document parsing.
 *
 * @param line One record, without its terminator.
 * @param delimiter Defaults to `','`; pass `'\\t'` for TSV.
 * @returns The record's fields. Always at least one element: `parseCsvLine('')`
 * returns `['']`.
 */
export function parseCsvLine(line: string, delimiter: string = DEFAULT_CSV_DELIMITER): string[] {
  if (typeof line !== 'string' || line.length === 0) return [''];
  if (!delimiter || delimiter.length === 0) delimiter = DEFAULT_CSV_DELIMITER;

  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotedField = false;
  let atFieldStart = true;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++; // consume the pair
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true;
      quotedField = true;
      atFieldStart = false;
      continue;
    }

    if (line.startsWith(delimiter, i)) {
      fields.push(quotedField ? field : field.trim());
      field = '';
      quotedField = false;
      atFieldStart = true;
      i += delimiter.length - 1;
      continue;
    }

    atFieldStart = false;
    field += char;
  }

  fields.push(quotedField ? field : field.trim());
  return fields;
}

/** Options for {@link parseCsv}. */
export interface ParseCsvOptions {
  /** Field delimiter. Defaults to {@link DEFAULT_CSV_DELIMITER}. */
  delimiter?: string;
  /**
   * Stop after this many records. Defaults to unlimited.
   *
   * The two component implementations both hardcoded `slice(1, 101)` — first
   * record as headers plus 100 data rows — and computed `totalRows` from the
   * full line count. That is a preview budget, not a parse limit, so it is an
   * explicit option here rather than a silent truncation: a caller that asks for
   * the whole file gets the whole file.
   */
  maxRows?: number;
}

/**
 * Parse a whole CSV/TSV document into rows of fields.
 *
 * A record separator INSIDE a quoted field does not end the record, so
 * `"line one\nline two",x` is one row of two fields. This is the case a
 * line-by-line `split(/\r?\n/)` cannot handle without corrupting the data.
 *
 * A leading UTF-8 BOM is stripped. `\n`, `\r\n` and a lone `\r` are all
 * accepted as record separators. Fully blank lines are skipped, matching what the
 * component versions did with their `.filter((l) => l.trim().length > 0)`.
 *
 * Rows are NOT padded to a common width: a short row stays short, so a consumer
 * can detect the ragged file rather than being handed invented empty cells.
 *
 * @param text The document contents.
 * @returns Rows in file order, INCLUDING the header row at index 0 when the
 * document has one. `[]` for `null`, `undefined`, `''` and a document with no
 * non-blank records. Never throws.
 */
export function parseCsv(
  text: string | null | undefined,
  options: ParseCsvOptions = {},
): string[][] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const delimiter =
    options.delimiter && options.delimiter.length > 0 ? options.delimiter : DEFAULT_CSV_DELIMITER;
  const maxRows =
    typeof options.maxRows === 'number' && options.maxRows > 0
      ? Math.floor(options.maxRows)
      : Number.POSITIVE_INFINITY;

  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotedField = false;
  let atFieldStart = true;
  let rowHasContent = false;

  const endField = () => {
    row.push(quotedField ? field : field.trim());
    field = '';
    quotedField = false;
    atFieldStart = true;
  };

  const endRow = () => {
    endField();
    // A line consisting solely of separators still produced fields, so it is
    // kept; a line with no characters at all is not a record.
    if (rowHasContent || row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
    row = [];
    rowHasContent = false;
  };

  for (let i = 0; i < body.length; i++) {
    const char = body[i];

    if (inQuotes) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true;
      quotedField = true;
      atFieldStart = false;
      rowHasContent = true;
      continue;
    }

    if (body.startsWith(delimiter, i)) {
      rowHasContent = true;
      endField();
      i += delimiter.length - 1;
      continue;
    }

    if (char === '\n' || char === '\r') {
      endRow();
      if (char === '\r' && body[i + 1] === '\n') i++;
      if (rows.length >= maxRows) break;
      continue;
    }

    atFieldStart = false;
    rowHasContent = true;
    field += char;
  }

  if (field.length > 0 || quotedField || row.length > 0 || rowHasContent) {
    endRow();
  }

  return rows;
}

// ─── Preview classification ──────────────────────────────────────────────────

/** How a document's bytes should be presented inline. */
export type PreviewKind =
  'markdown' | 'text' | 'code' | 'csv' | 'pdf' | 'image' | 'video' | 'audio' | 'none';

/**
 * Extensions that render as markdown, keyed off the file name.
 * `EXTENSION_MAP` maps `md`/`markdown` to the `markdown` type
 * (`document_service.py:24-25`).
 */
const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set(['md', 'markdown', 'mdown']);

/**
 * Plain-text extensions. `rtf` is included because `DocumentsHub`'s
 * `CATEGORY_EXTENSIONS.documents` set listed it; it renders as readable text
 * even though the markup itself is not interpreted.
 */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['txt', 'text', 'log', 'rtf']);

/**
 * Tabular extensions, including TSV — both component parsers branched on
 * `ext === 'tsv'` to swap the delimiter to a tab.
 */
const CSV_EXTENSIONS: ReadonlySet<string> = new Set(['csv', 'tsv']);

/**
 * Source-code and structured-data extensions, as the UNION of the three
 * component tables: `DocumentsHub`'s `CATEGORY_EXTENSIONS.code`
 * (`js jsx ts tsx py json yaml yml html css sql sh bash`), plus the wider list
 * both `DocumentDetailView` and `DocumentPreviewModal` used
 * (`go rs cpp c h`), plus `xml`.
 */
const CODE_EXTENSIONS: ReadonlySet<string> = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'json',
  'jsonl',
  'yaml',
  'yml',
  'toml',
  'ini',
  'html',
  'htm',
  'css',
  'scss',
  'sql',
  'sh',
  'bash',
  'zsh',
  'go',
  'rs',
  'cpp',
  'cc',
  'c',
  'h',
  'hpp',
  'java',
  'rb',
  'php',
  'swift',
  'kt',
  'xml',
]);

/**
 * Raster and vector image extensions, as the UNION of the three component sets:
 * `DocumentsHub` used `png jpg jpeg webp gif svg bmp ico`, `DocumentDetailView`
 * used the same list, and `CATEGORY_EXTENSIONS.images` additionally carried
 * `tiff`.
 */
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'bmp',
  'ico',
  'tiff',
  'tif',
  'avif',
]);

const PDF_EXTENSIONS: ReadonlySet<string> = new Set(['pdf']);

const VIDEO_EXTENSIONS: ReadonlySet<string> = new Set(['mp4', 'mov', 'webm', 'm4v', 'ogv']);

const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac']);

/**
 * Backend `Document.type` values, from `EXTENSION_MAP`
 * (`document_service.py:22-45`), plus the values the UI has always accepted.
 *
 * The 13 values the backend can actually emit are `pdf`, `markdown`, `text`,
 * `docx`, `csv`, `xlsx`, `pptx`, `json`, `html`, `xml`, `yaml`, `image` and
 * `unknown`. On top of those this map accepts:
 *  - the per-format spellings the components used as a fallback (`png`, `jpg`,
 *    `jpeg`, `webp`, `gif`, `svg`, `bmp`, `ico`) — legacy values that predate
 *    `EXTENSION_MAP` collapsing every image to `image`;
 *  - `sql`, `ts`, `js`, `py`, which `DocumentDetailView`'s `TEXT_TYPES` set
 *    listed as types rather than extensions;
 *  - `code`, `video`, `audio`, which no backend path writes but which the UI
 *    has always understood;
 *  - `vault_note`, checked by `DocumentsHub` and `DocumentPreviewModal`, and
 *    rendered as markdown. NOT produced by `EXTENSION_MAP`.
 *
 * `docx`, `xlsx` and `pptx` are deliberately ABSENT: they are zip containers,
 * not renderable text, and every component already fell through to the
 * download/unsupported branch for them. `unknown` is absent so the extension
 * gets a chance before the type vetoes the preview.
 */
const TYPE_KINDS: Readonly<Record<string, PreviewKind>> = {
  // Backend EXTENSION_MAP values.
  pdf: 'pdf',
  markdown: 'markdown',
  text: 'text',
  csv: 'csv',
  json: 'code',
  html: 'code',
  xml: 'code',
  yaml: 'code',
  image: 'image',
  // Legacy per-format type values.
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  svg: 'image',
  bmp: 'image',
  ico: 'image',
  // Types the UI accepted but the backend does not write.
  sql: 'code',
  ts: 'code',
  js: 'code',
  py: 'code',
  code: 'code',
  video: 'video',
  audio: 'audio',
  vault_note: 'markdown',
};

/**
 * MIME types, consulted only when neither the extension nor the backend type
 * decides. Keys are the value of `Document.detectedMimeType`
 * (`detected_mime_type` on the wire, `document_service.py:15`) or a browser
 * `Blob.type`.
 *
 * Prefix entries (`image/`, `video/`, `audio/`) are checked after the exact
 * matches, so `text/markdown` beats a blanket `text/` rule.
 */
const MIME_KINDS: Readonly<Record<string, PreviewKind>> = {
  'application/pdf': 'pdf',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'application/json': 'code',
  'text/json': 'code',
  'text/html': 'code',
  'application/xhtml+xml': 'code',
  'application/xml': 'code',
  'text/xml': 'code',
  'application/yaml': 'code',
  'text/yaml': 'code',
  'application/x-yaml': 'code',
  'text/plain': 'text',
};

const MIME_PREFIX_KINDS: ReadonlyArray<readonly [string, PreviewKind]> = [
  ['image/', 'image'],
  ['video/', 'video'],
  ['audio/', 'audio'],
];

/**
 * The lowercased extension of a file name or path, without the dot.
 *
 * A leading dot is treated as a hidden file with no extension rather than an
 * extension: `.gitignore` has no extension, and `path.extname`-style code that
 * treats it as one produces a preview kind named `gitignore`.
 *
 * @returns The extension, or `''` when there is none.
 */
export function extensionOf(pathOrName: string | null | undefined): string {
  const name = getFileName(pathOrName);
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/**
 * The MIME type to use when re-wrapping a downloaded blob so the browser renders
 * it correctly.
 *
 * The backend's content endpoint returns the bytes with whatever content type
 * the object store held, which for a `.md` or `.csv` is frequently
 * `application/octet-stream`. Without a corrected type a `<img>` or `<iframe>`
 * refuses the blob. This is the resolution `DocumentsHub` inlined at lines
 * 661-691.
 *
 * @returns A MIME type, or `null` when the extension is unknown — in which case
 * the caller should keep the blob's own type rather than invent one.
 */
export function mimeForExtension(pathOrExtension: string | null | undefined): string | null {
  if (typeof pathOrExtension !== 'string' || pathOrExtension.length === 0) return null;
  const trimmed = pathOrExtension.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  const ext = trimmed.includes('/') ? extensionOf(trimmed) : trimmed.replace(/^\./, '');
  if (!ext) return null;

  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'md':
    case 'markdown':
    case 'mdown':
      return 'text/markdown';
    case 'csv':
      return 'text/csv';
    case 'tsv':
      return 'text/tab-separated-values';
    case 'json':
    case 'jsonl':
      return 'application/json';
    case 'yaml':
    case 'yml':
      return 'application/yaml';
    case 'html':
    case 'htm':
      return 'text/html';
    case 'xml':
      return 'application/xml';
    case 'txt':
    case 'text':
    case 'log':
    case 'rtf':
      return 'text/plain';
    case 'svg':
      return 'image/svg+xml';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    default:
      break;
  }

  if (IMAGE_EXTENSIONS.has(ext)) return `image/${ext}`;
  if (VIDEO_EXTENSIONS.has(ext)) return `video/${ext}`;
  if (AUDIO_EXTENSIONS.has(ext)) return `audio/${ext}`;
  // Source files render as plain text; a syntax-specific type would only make
  // the browser offer a download instead of displaying it.
  if (CODE_EXTENSIONS.has(ext)) return 'text/plain';
  return null;
}

/** Options for {@link previewKind}. */
export interface PreviewKindOptions {
  /**
   * The backend's `Document.type`. Normally passed straight through from
   * `doc.type`.
   */
  type?: string | null;
  /**
   * The file name or path. A full path is fine — only the extension is read.
   * Pass this instead of `ext` when a path is all that is to hand.
   */
  path?: string | null;
}

/**
 * Classify a document for inline preview.
 *
 * RESOLUTION ORDER, and why: extension, then backend `type`, then MIME.
 *
 *  1. **Extension** is what the user sees in the file name and is the most
 *     specific signal, so it wins. `report.csv` is a CSV even if the scanner
 *     sniffed `text/plain`.
 *  2. **Backend `type`** is `EXTENSION_MAP`'s classification of that same
 *     extension, so it is normally redundant — but it is the only signal for a
 *     path with no extension at all.
 *  3. **MIME** is last because it is the fallback the components never actually
 *     reached: they read `doc.detected_mime_type`, a key that is `undefined` at
 *     runtime because `transformKeys` renames it to `detectedMimeType`. A file
 *     uploaded with no extension but detected as `text/markdown` is the case this
 *     recovers.
 *
 * One refinement: a `text/markdown` MIME upgrades a `'text'` verdict to
 * `'markdown'`, because markdown is a text subtype and the markdown renderer is
 * strictly better than a `<pre>` block for it.
 *
 * `docx`, `xlsx` and `pptx` resolve to `'none'` and must be downloaded.
 *
 * @param mime `doc.detectedMimeType`, or a `Blob.type`. Optional.
 * @param ext The extension without a dot. Optional; derived from `path` when
 * omitted.
 * @param type The backend `Document.type`. Optional.
 * @returns A {@link PreviewKind}; `'none'` when the document cannot be shown
 * inline, including when every argument is missing. Never throws.
 */
export function previewKind(
  mime?: string | null,
  ext?: string | null,
  type?: string | null,
  options: PreviewKindOptions = {},
): PreviewKind {
  const normalizedExt =
    typeof ext === 'string' && ext.length > 0
      ? ext.trim().replace(/^\./, '').toLowerCase()
      : options.path !== undefined && options.path !== null
        ? extensionOf(options.path)
        : '';
  const normalizedType =
    typeof type === 'string' && type.length > 0
      ? type.trim().toLowerCase()
      : typeof options.type === 'string' && options.type.length > 0
        ? options.type.trim().toLowerCase()
        : '';
  const normalizedMime = typeof mime === 'string' ? mime.trim().toLowerCase().split(';')[0] : '';

  let kind: PreviewKind = 'none';

  if (normalizedExt) {
    if (MARKDOWN_EXTENSIONS.has(normalizedExt)) kind = 'markdown';
    else if (CSV_EXTENSIONS.has(normalizedExt)) kind = 'csv';
    else if (PDF_EXTENSIONS.has(normalizedExt)) kind = 'pdf';
    else if (IMAGE_EXTENSIONS.has(normalizedExt)) kind = 'image';
    else if (VIDEO_EXTENSIONS.has(normalizedExt)) kind = 'video';
    else if (AUDIO_EXTENSIONS.has(normalizedExt)) kind = 'audio';
    else if (CODE_EXTENSIONS.has(normalizedExt)) kind = 'code';
    else if (TEXT_EXTENSIONS.has(normalizedExt)) kind = 'text';
  }

  if (kind === 'none' && normalizedType) {
    kind = TYPE_KINDS[normalizedType] ?? 'none';
  }

  if (kind === 'none' && normalizedMime) {
    const exact = MIME_KINDS[normalizedMime];
    if (exact) {
      kind = exact;
    } else {
      for (const [prefix, prefixKind] of MIME_PREFIX_KINDS) {
        if (normalizedMime.startsWith(prefix)) {
          kind = prefixKind;
          break;
        }
      }
    }
  }

  if (kind === 'text' && normalizedMime === 'text/markdown') return 'markdown';

  return kind;
}

/**
 * Whether a document can be shown in the preview modal rather than only
 * downloaded.
 *
 * A thin predicate over {@link previewKind}, kept because three components
 * branched on "is this previewable at all" with three different — and mutually
 * inconsistent — sets of extensions. `.exe` returns `false`, and so does every
 * Office binary format.
 *
 * @param mime `doc.detectedMimeType` or a `Blob.type`. Optional.
 * @param ext The extension without a dot. Optional.
 * @param type The backend `Document.type`. Optional.
 * @param options `{ path }` to derive the extension from a full path instead.
 * @returns `true` when {@link previewKind} is anything other than `'none'`.
 * Never throws.
 */
export function isInlinePreviewable(
  mime?: string | null,
  ext?: string | null,
  type?: string | null,
  options: PreviewKindOptions = {},
): boolean {
  return previewKind(mime, ext, type, options) !== 'none';
}
