'use client';

import { useState, useRef } from 'react';
import { useCards } from '@/lib/context';
import type { CreditCard } from '@/lib/types';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const now = new Date();
      const cards: CreditCard[] = validRows.map((row, i) => ({
        id: crypto.randomUUID(),
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

      await bulkAddCards(cards);
      handleClose();
    } catch {
      // Handle error silently — user can retry
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
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

          {step === 'upload' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a CSV file with your credit card details. Download the template below to get started.
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
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">then upload</span></div>
              </div>

              <label className="block w-full px-4 py-8 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                <svg className="mx-auto mb-2 text-gray-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <span className="text-sm text-gray-500">Tap to select CSV file</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>

              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>Expected columns:</strong> Name, Balance, APR, Minimum Payment, Credit Limit, Statement Date, Due Date</p>
                <p>Dollar amounts in dollars (e.g., 5000.00). APR as percentage (e.g., 24.99). Dates as day of month (1-31).</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {rows.filter((r) => r.valid).length} of {rows.length} rows ready to import
                </p>
                <button
                  onClick={() => { setStep('upload'); setRows([]); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Choose different file
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

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Skip header row
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 7) {
      rows.push({
        name: cols[0] || `Row ${i}`,
        balance: 0, apr: 0, minimumPayment: 0, creditLimit: 0,
        statementDate: 1, dueDate: 15,
        valid: false,
        error: 'Not enough columns',
      });
      continue;
    }

    const [name, balanceStr, aprStr, minStr, limitStr, stmtStr, dueStr] = cols;

    const balance = Math.round(parseFloat(balanceStr) * 100);
    const apr = parseFloat(aprStr);
    const minimumPayment = Math.round(parseFloat(minStr) * 100);
    const creditLimit = Math.round(parseFloat(limitStr) * 100);
    const statementDate = parseInt(stmtStr);
    const dueDate = parseInt(dueStr);

    let error: string | undefined;
    if (!name?.trim()) error = 'Missing name';
    else if (isNaN(balance) || balance < 0) error = 'Invalid balance';
    else if (isNaN(apr) || apr < 0 || apr > 100) error = 'Invalid APR';
    else if (isNaN(minimumPayment) || minimumPayment < 0) error = 'Invalid min payment';
    else if (isNaN(creditLimit) || creditLimit < 0) error = 'Invalid credit limit';
    else if (isNaN(statementDate) || statementDate < 1 || statementDate > 31) error = 'Invalid statement date';
    else if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) error = 'Invalid due date';

    rows.push({
      name: name?.trim() || '',
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
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
      } else if (ch === ',') {
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
