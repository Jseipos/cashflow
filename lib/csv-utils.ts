/**
 * Shared CSV parsing utilities — used by SettingsModal and CSVImport.
 * Replaces fragile file-based parsing with robust paste-based parsing.
 */

/** Normalize all line endings to \n */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Auto-detect the delimiter from the first non-empty line */
export function detectDelimiter(text: string): string {
  const normalized = normalizeLineEndings(text);
  const firstLine = normalized.split('\n').find((l) => l.trim().length > 0);
  if (!firstLine) return ',';
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';')) return ';';
  return ',';
}

/**
 * Parse a single CSV/TSV line, handling quoted fields and the given delimiter.
 */
export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  result.push(current.trim());
  return result;
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parse pasted text into headers + rows.
 * Normalizes line endings, auto-detects delimiter, handles quoted fields.
 */
export function parsePastedCSV(text: string): ParsedCSV {
  if (!text || !text.trim()) {
    return { headers: [], rows: [] };
  }

  const normalized = normalizeLineEndings(text);
  const delimiter = detectDelimiter(text);
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/^"|"$/g, '').trim()
  );

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseDelimitedLine(lines[i], delimiter));
  }

  return { headers, rows };
}

/** Safe cell access — returns trimmed string or default */
export function safeCell(row: string[], idx: number, fallback = ''): string {
  const val = row[idx];
  if (val == null) return fallback;
  return val.trim();
}

/** Safe float parse — returns fallback on failure */
export function safeFloat(val: string, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[$,\s%]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

/** Safe int parse — returns fallback on failure */
export function safeInt(val: string, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[,\s%]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/** Convert dollar string to cents (integer) */
export function dollarsToCents(val: string, fallback = 0): number {
  const dollars = safeFloat(val, NaN);
  if (isNaN(dollars)) return fallback;
  return Math.round(dollars * 100);
}
