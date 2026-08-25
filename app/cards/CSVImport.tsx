'use client';

import { useState } from 'react';
import { useCards } from '@/lib/context';
import type { CreditCard } from '@/lib/types';
import { normalizeLineEndings, detectDelimiter, parseDelimitedLine, safeCell, safeFloat, safeInt, dollarsToCents } from '@/lib/csv-utils';

interface CSVImportProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  creditLimit: number;
  statementDate: number;
  dueDate: number;
  valid: boolean;
  error?: string;
}

const CARD_COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

export function CSVImport({ open, onClose }: CSVImportProps) {
  const { bulkAddCards } = useCards();
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'paste' | 'preview'>('paste');

  if (!open) return null;

  const handleParse = () => {
    const parsed = parseCardCSV(pasteText);
    setRows(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    console.log('handleImport called, rows:', rows.length);
    const validRows = rows.filter((r) => r.valid);
    console.log('validRows:', validRows.length);
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const now = new Date();
      const cards: CreditCard[] = validRows.map((row, i) => ({
        id: generateId(),
        name: row.name,
        balance: row.balance,
        apr: row.apr,
        minimumPayment: row.minimumPayment,
        creditLimit: row.creditLimit,
        statementDate: row.statementDate,
        dueDate: row.dueDate,
        color: CARD_COLORS[i % CARD_COLORS.length],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));
      console.log('cards to import:', cards);

      await bulkAddCards(cards);
      console.log('bulkAddCards completed');
      handleClose();
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setPasteText('');
    setStep('paste');
    onClose();
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/credit-cards-template.csv';
    link.download = 'credit-cards-template.csv';
    link.click();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Import Credit Cards</h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {step === 'paste' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Copy your credit card data from a spreadsheet and paste it below. Tab or comma separated.
              </p>

              <button
                onClick={downloadTemplate}
                className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download CSV Template
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">then paste below</span></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Paste Credit Card Data
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Name,Balance,APR,Minimum Payment,Credit Limit,Statement Date,Due Date&#10;Chase Sapphire,5000.00,24.99,150.00,15000.00,1,15"
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
                  autoFocus
                />
              </div>

              <button
                onClick={handleParse}
                disabled={!pasteText.trim()}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Preview Data
              </button>

              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>Expected columns:</strong> Name, Balance, APR, Minimum Payment, Credit Limit, Statement Date, Due Date</p>
                <p>Dollar amounts in dollars (e.g., 5000.00). APR as percentage (e.g., 24.99). Dates as day of month (1-31).</p>
                <p>Auto-detects: commas, tabs, or semicolons. Handles quoted fields.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {rows.filter((r) => r.valid).length} of {rows.length} rows ready to import
                </p>
                <button
                  onClick={() => { setStep('paste'); setRows([]); }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit pasted data
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-sm ${
                      row.valid ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{row.name || 'Unnamed'}</span>
                      {!row.valid && (
                        <span className="text-xs text-red-600">{row.error}</span>
                      )}
                    </div>
                    {row.valid && (
                      <div className="text-xs text-gray-500 mt-1">
                        ${(row.balance / 100).toFixed(2)} • {row.apr}% APR • Min ${(row.minimumPayment / 100).toFixed(2)} • Due {row.dueDate}th
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || rows.filter((r) => r.valid).length === 0}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Import ${rows.filter((r) => r.valid).length} Cards`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Parse pasted text into card rows.
 * Handles comma, tab, semicolon delimiters and quoted fields.
 */
function parseCardCSV(text: string): ParsedRow[] {
  if (!text || !text.trim()) return [];

  const normalized = normalizeLineEndings(text);
  const delimiter = detectDelimiter(text);
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) return [];

  // Parse header to find column positions
  const headerCols = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/^"|"$/g, '').trim()
  );

  const nameIdx = headerCols.findIndex((h) => h.includes('name'));
  const balanceIdx = headerCols.findIndex((h) => h.includes('balance'));
  const aprIdx = headerCols.findIndex((h) => h.includes('apr'));
  const minIdx = headerCols.findIndex((h) => h.includes('min'));
  const limitIdx = headerCols.findIndex((h) => h.includes('limit') || h.includes('credit'));
  const stmtIdx = headerCols.findIndex((h) => h.includes('statement') || h === 'stmt');
  const dueIdx = headerCols.findIndex((h) => h.includes('due'));

  // If no recognizable headers, assume positional (Name, Balance, APR, Min, Limit, Stmt, Due)
  const usePositional = nameIdx === -1 && balanceIdx === -1;

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i], delimiter);

    // Need at least 7 columns for positional, or at least 1 for header-mapped
    if (usePositional && cols.length < 7) {
      rows.push({
        name: safeCell(cols, 0, `Row ${i}`),
        balance: 0, apr: 0, minimumPayment: 0, creditLimit: 0,
        statementDate: 1, dueDate: 15,
        valid: false,
        error: `Not enough columns (got ${cols.length}, need 7)`,
      });
      continue;
    }

    if (!usePositional && cols.length < 1) {
      rows.push({
        name: `Row ${i}`,
        balance: 0, apr: 0, minimumPayment: 0, creditLimit: 0,
        statementDate: 1, dueDate: 15,
        valid: false,
        error: 'Empty row',
      });
      continue;
    }

    const name = usePositional ? safeCell(cols, 0) : safeCell(cols, nameIdx >= 0 ? nameIdx : 0);
    const balance = usePositional ? dollarsToCents(safeCell(cols, 1)) : dollarsToCents(safeCell(cols, balanceIdx >= 0 ? balanceIdx : 1));
    const apr = usePositional ? safeFloat(safeCell(cols, 2)) : safeFloat(safeCell(cols, aprIdx >= 0 ? aprIdx : 2));
    const minimumPayment = usePositional ? dollarsToCents(safeCell(cols, 3)) : dollarsToCents(safeCell(cols, minIdx >= 0 ? minIdx : 3));
    const creditLimit = usePositional ? dollarsToCents(safeCell(cols, 4)) : dollarsToCents(safeCell(cols, limitIdx >= 0 ? limitIdx : 4));
    const statementDate = usePositional ? safeInt(safeCell(cols, 5, '1')) : safeInt(safeCell(cols, stmtIdx >= 0 ? stmtIdx : 5, '1'));
    const dueDate = usePositional ? safeInt(safeCell(cols, 6, '15')) : safeInt(safeCell(cols, dueIdx >= 0 ? dueIdx : 6, '15'));

    let error: string | undefined;
    if (!name) error = 'Missing name';
    else if (isNaN(balance) || balance < 0) error = 'Invalid balance';
    else if (isNaN(apr) || apr < 0 || apr > 100) error = 'Invalid APR';
    else if (isNaN(minimumPayment) || minimumPayment < 0) error = 'Invalid min payment';
    else if (isNaN(creditLimit) || creditLimit < 0) error = 'Invalid credit limit';
    else if (isNaN(statementDate) || statementDate < 1 || statementDate > 31) error = 'Invalid statement date';
    else if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) error = 'Invalid due date';

    rows.push({
      name,
      balance: isNaN(balance) ? 0 : balance,
      apr: isNaN(apr) ? 0 : apr,
      minimumPayment: isNaN(minimumPayment) ? 0 : minimumPayment,
      creditLimit: isNaN(creditLimit) ? 0 : creditLimit,
      statementDate: isNaN(statementDate) ? 1 : statementDate,
      dueDate: isNaN(dueDate) ? 15 : dueDate,
      valid: !error,
      error,
    });
  }

  return rows;
}

/**
 * Generate a unique ID, with fallback for environments without crypto.randomUUID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random string
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
