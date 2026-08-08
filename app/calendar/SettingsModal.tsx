'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCashflow } from '@/lib/context';
import { formatCurrency } from '@/lib/calculations';
import { getDB, getAllScheduledItems, getAllAccounts, getAllCreditCards, getAllCategories } from '@/lib/db';
import { normalizeLineEndings, detectDelimiter, parseDelimitedLine, safeCell, dollarsToCents } from '@/lib/csv-utils';
import type { ScheduledItem } from '@/lib/types';
import type { Account } from '@/lib/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const ACCOUNT_TYPES: Account['type'][] = ['checking', 'savings', 'cash', 'credit'];
const ACCOUNT_ICONS: Record<Account['type'], string> = {
  checking: '🏦',
  savings: '🐷',
  cash: '💵',
  credit: '💳',
};
const ACCOUNT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#6366f1'];

type ExportRange = '30d' | '90d' | 'all' | 'custom';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { accounts, selectedAccount, updateAccount, addAccount, deleteAccount, scheduledItems, refresh } = useCashflow();

  const [balance, setBalance] = useState('');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Export state
  const [exportRange, setExportRange] = useState<ExportRange>('30d');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exporting, setExporting] = useState(false);

  // Full backup state
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste CSV import state
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<PastePreviewRow[]>([]);
  const [pasteStep, setPasteStep] = useState<'input' | 'preview'>('input');
  const [importingCsv, setImportingCsv] = useState(false);

  useEffect(() => {
    if (open && selectedAccount) {
      setBalance(String((selectedAccount.currentBalance / 100).toFixed(2)));
      setThreshold(String((selectedAccount.lowBalanceThreshold / 100).toFixed(2)));
      setError(null);
      setShowAccountForm(false);
      setEditingAccount(null);
    }
  }, [open, selectedAccount]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAccount) return;

    const balanceCents = Math.round(parseFloat(balance) * 100);
    const thresholdCents = Math.round(parseFloat(threshold) * 100);

    if (isNaN(balanceCents)) {
      setError('Enter a valid balance');
      return;
    }
    if (isNaN(thresholdCents)) {
      setError('Enter a valid threshold');
      return;
    }

    setSaving(true);
    try {
      await updateAccount({
        ...selectedAccount,
        currentBalance: balanceCents,
        lowBalanceThreshold: thresholdCents,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAccount = useCallback((acct: Account) => {
    setEditingAccount(acct);
    setShowAccountForm(true);
  }, []);

  const handleDeleteAccount = useCallback(async (id: string, name: string) => {
    if (accounts.length <= 1) {
      setError('Cannot delete the last account');
      return;
    }
    if (confirm(`Delete account "${name}"? This will also remove scheduled items for this account.`)) {
      try {
        // Delete associated scheduled items
        const db = getDB();
        const items = await db.scheduledItems.where('accountId').equals(id).toArray();
        await db.scheduledItems.bulkDelete(items.map((i) => i.id));
        await deleteAccount(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete account');
      }
    }
  }, [accounts.length, deleteAccount]);

  // ---- CSV Export ----
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const allItems = await getAllScheduledItems();
      const allAccounts = await getAllAccounts();
      const allCards = await getAllCreditCards();
      const allCategories = await getAllCategories();

      // Build lookup maps
      const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
      const cardMap = new Map(allCards.map((c) => [c.id, c]));
      const catMap = new Map(allCategories.map((c) => [c.id, c]));

      // Determine date range
      let rangeStart: Date;
      let rangeEnd: Date;
      const now = new Date();

      if (exportRange === '30d') {
        rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - 30);
        rangeEnd = now;
      } else if (exportRange === '90d') {
        rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - 90);
        rangeEnd = now;
      } else if (exportRange === 'all') {
        rangeStart = new Date(2000, 0, 1);
        rangeEnd = new Date(2100, 0, 1);
      } else {
        rangeStart = exportStart ? new Date(exportStart + 'T00:00:00') : new Date(2000, 0, 1);
        rangeEnd = exportEnd ? new Date(exportEnd + 'T23:59:59') : new Date(2100, 0, 1);
      }

      // Filter items by date range
      const filtered = allItems.filter((item) => {
        const d = new Date(item.startDate);
        return d >= rangeStart && d <= rangeEnd;
      });

      // Build CSV
      const headers = ['Date', 'Description', 'Type', 'Amount', 'Account', 'Category', 'Recurrence'];
      const rows = filtered.map((item) => {
        const account = accountMap.get(item.accountId);
        const toAccount = item.toAccountId ? accountMap.get(item.toAccountId) : null;
        const category = item.categoryId ? catMap.get(item.categoryId) : null;

        const accountLabel = toAccount
          ? `${account?.name ?? 'Unknown'} → ${toAccount.name}`
          : account?.name ?? 'Unknown';

        return [
          formatCSVDate(new Date(item.startDate)),
          escapeCSV(item.description),
          item.type,
          String(item.amount / 100), // dollars
          escapeCSV(accountLabel),
          escapeCSV(category?.name ?? ''),
          item.recurrence,
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cashflow-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exportRange, exportStart, exportEnd]);

  // ---- Full Backup (JSON) ----
  const handleFullBackup = useCallback(async () => {
    setBackingUp(true);
    try {
      const db = getDB();
      const [accounts, scheduledItems, creditCards, wishlistItems, categories] = await Promise.all([
        db.accounts.toArray(),
        db.scheduledItems.toArray(),
        db.creditCards.toArray(),
        db.wishlistItems.toArray(),
        db.categories.toArray(),
      ]);

      const backup = {
        version: 3,
        exportedAt: new Date().toISOString(),
        accounts,
        scheduledItems,
        creditCards,
        wishlistItems,
        categories,
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cashflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  }, []);

  // ---- Download Template ----
  const handleDownloadTemplate = useCallback(() => {
    const now = new Date().toISOString();
    const template = {
      version: 3,
      exportedAt: now,
      _instructions: 'Fill in your data below. Amounts are in cents (multiply dollars by 100). Dates in ISO format. Leave arrays empty [] if not needed. Import this file via the Restore button.',
      accounts: [
        {
          id: 'account-1',
          name: 'Checking',
          type: 'checking',
          currentBalance: 0,
          lowBalanceThreshold: 10000,
          color: '#3b82f6',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      scheduledItems: [
        {
          id: 'item-example-1',
          accountId: 'account-1',
          type: 'expense',
          amount: 150000,
          description: 'Rent',
          categoryId: null,
          recurrence: 'monthly',
          startDate: now,
          endDate: null,
          isActive: true,
          lastProcessedDate: null,
          sourceId: null,
          sourceType: null,
          toAccountId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      creditCards: [
        {
          id: 'card-example-1',
          name: 'Chase Sapphire',
          balance: 500000,
          apr: 24.99,
          minimumPayment: 15000,
          creditLimit: 1500000,
          statementDate: 1,
          dueDate: 15,
          color: '#3b82f6',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      wishlistItems: [
        {
          id: 'wish-example-1',
          name: 'New Laptop',
          estimatedCost: 120000,
          priority: 1,
          monthlySavings: 20000,
          targetDate: null,
          savedSoFar: 0,
          isActive: true,
          isPurchased: false,
          savingsDay: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      categories: [],
    };

    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cashflow-import-template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // ---- Restore from Backup (JSON only) ----
  const handleRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setRestoreMsg(null);
    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.accounts || !Array.isArray(data.accounts)) {
        throw new Error('Invalid backup file: missing accounts array');
      }

      const db = getDB();

      // Clear existing data
      await Promise.all([
        db.accounts.clear(),
        db.scheduledItems.clear(),
        db.creditCards.clear(),
        db.wishlistItems.clear(),
        db.categories.clear(),
      ]);

      // Restore dates from strings
      const parseDates = (obj: Record<string, unknown>, fields: string[]) => {
        for (const f of fields) {
          if (obj[f] && typeof obj[f] === 'string') {
            obj[f] = new Date(obj[f] as string);
          }
        }
        return obj;
      };

      const dateFields = ['createdAt', 'updatedAt', 'startDate', 'endDate', 'lastProcessedDate', 'targetDate'];

      if (data.accounts?.length) {
        await db.accounts.bulkAdd(data.accounts.map((a: Record<string, unknown>) => parseDates(a, dateFields)));
      }
      if (data.scheduledItems?.length) {
        await db.scheduledItems.bulkAdd(data.scheduledItems.map((i: Record<string, unknown>) => parseDates(i, dateFields)));
      }
      if (data.creditCards?.length) {
        await db.creditCards.bulkAdd(data.creditCards.map((c: Record<string, unknown>) => parseDates(c, dateFields)));
      }
      if (data.wishlistItems?.length) {
        await db.wishlistItems.bulkAdd(data.wishlistItems.map((w: Record<string, unknown>) => parseDates(w, dateFields)));
      }
      if (data.categories?.length) {
        await db.categories.bulkAdd(data.categories.map((c: Record<string, unknown>) => parseDates(c, dateFields)));
      }

      const counts = [
        data.accounts?.length ? `${data.accounts.length} accounts` : null,
        data.scheduledItems?.length ? `${data.scheduledItems.length} items` : null,
        data.creditCards?.length ? `${data.creditCards.length} cards` : null,
        data.wishlistItems?.length ? `${data.wishlistItems.length} wishlist` : null,
        data.categories?.length ? `${data.categories.length} categories` : null,
      ].filter(Boolean).join(', ');

      setRestoreMsg(`Restored: ${counts}`);
      await refresh();
      setTimeout(() => setRestoreMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed — invalid JSON file');
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // ---- Paste CSV Import: scheduled items only ----
  const handleParsePaste = useCallback(() => {
    const parsed = parseScheduledCSV(pasteText);
    setPastePreview(parsed);
    setPasteStep('preview');
  }, [pasteText]);

  const handleImportPaste = useCallback(async () => {
    const validRows = pastePreview.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImportingCsv(true);
    setError(null);

    try {
      const db = getDB();
      const now = new Date();

      // Resolve account and category names to IDs
      const allAccounts = await db.accounts.toArray();
      const defaultAccount = allAccounts[0];
      if (!defaultAccount) throw new Error('No account found — create one first');
      const accountByName = new Map(allAccounts.map((a) => [a.name.toLowerCase(), a]));

      const allCategories = await db.categories.toArray();
      const catByName = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]));

      const items: ScheduledItem[] = validRows.map((row) => {
        const account = row.accountName
          ? accountByName.get(row.accountName.toLowerCase()) ?? defaultAccount
          : defaultAccount;
        const category = row.categoryName
          ? catByName.get(row.categoryName.toLowerCase())
          : undefined;

        return {
          id: crypto.randomUUID(),
          accountId: account.id,
          type: row.type,
          amount: row.amount,
          description: row.description,
          categoryId: category?.id ?? undefined,
          recurrence: row.recurrence,
          startDate: new Date(row.dateStr + 'T12:00:00'),
          endDate: null,
          isActive: true,
          lastProcessedDate: null,
          createdAt: now,
          updatedAt: now,
        };
      });

      await db.scheduledItems.bulkAdd(items);
      setRestoreMsg(`Imported ${items.length} scheduled items`);
      await refresh();
      setTimeout(() => setRestoreMsg(null), 3000);

      // Reset paste state
      setShowPasteImport(false);
      setPasteText('');
      setPastePreview([]);
      setPasteStep('input');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImportingCsv(false);
    }
  }, [pastePreview, refresh]);

  const handleClosePasteImport = useCallback(() => {
    setShowPasteImport(false);
    setPasteText('');
    setPastePreview([]);
    setPasteStep('input');
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Account Management Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Accounts</h3>
              <button
                onClick={() => { setEditingAccount(null); setShowAccountForm(true); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                + Add Account
              </button>
            </div>

            {/* Account list */}
            <div className="space-y-1.5 mb-2">
              {accounts.map((acct) => (
                <div
                  key={acct.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ACCOUNT_ICONS[acct.type]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{acct.name}</p>
                      <p className="text-xs text-gray-500">
                        {acct.type} · {formatCurrency(acct.currentBalance)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditAccount(acct)}
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                      aria-label="Edit account"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {accounts.length > 1 && (
                      <button
                        onClick={() => handleDeleteAccount(acct.id, acct.name)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-500"
                        aria-label="Delete account"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add/Edit account form */}
            {showAccountForm && (
              <AccountForm
                editingAccount={editingAccount}
                onSave={async (acct) => {
                  if (editingAccount) {
                    await updateAccount(acct);
                  } else {
                    await addAccount(acct);
                  }
                  setShowAccountForm(false);
                  setEditingAccount(null);
                }}
                onCancel={() => { setShowAccountForm(false); setEditingAccount(null); }}
              />
            )}
          </div>

          {/* Selected account settings (balance + threshold) */}
          {selectedAccount && !showAccountForm && (
            <form onSubmit={handleSave} className="space-y-4 border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {selectedAccount.name} Settings
              </h3>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Current Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Currently: {formatCurrency(selectedAccount.currentBalance)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Low Balance Threshold
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Days below this amount are flagged in yellow.
                </p>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Export Data Section */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Export Data
            </h3>

            {/* Date range selector */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {([
                { key: '30d', label: '30 days' },
                { key: '90d', label: '90 days' },
                { key: 'all', label: 'All time' },
                { key: 'custom', label: 'Custom' },
              ] as { key: ExportRange; label: string }[]).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setExportRange(r.key)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                    exportRange === r.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Custom date range inputs */}
            {exportRange === 'custom' && (
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input
                    type="date"
                    value={exportStart}
                    onChange={(e) => setExportStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <input
                    type="date"
                    value={exportEnd}
                    onChange={(e) => setExportEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {exporting ? 'Exporting...' : '⬇ Download CSV'}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Exports all scheduled items as a CSV file
            </p>
          </div>

          {/* Full Backup & Restore Section */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Backup & Sync
            </h3>

            <div className="space-y-2">
              {/* Download full backup */}
              <button
                onClick={handleFullBackup}
                disabled={backingUp}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {backingUp ? 'Creating Backup...' : '📦 Export All Data (JSON)'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Everything: accounts, items, cards, wishlist, categories
              </p>

              {/* Download template */}
              <button
                onClick={handleDownloadTemplate}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                📄 Download Import Template
              </button>
              <p className="text-xs text-gray-400 text-center">
                Blank JSON template to fill in and upload on another device
              </p>

              {/* Restore from JSON file */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestore}
                className="hidden"
                id="restore-file-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={restoring}
                className="w-full px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-medium text-sm hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {restoring ? 'Importing...' : '📥 Restore from JSON Backup'}
              </button>
              <p className="text-xs text-amber-600 text-center">
                ⚠️ Replaces all data with backup contents
              </p>

              {restoreMsg && (
                <div className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm text-center">
                  ✅ {restoreMsg}
                </div>
              )}
            </div>
          </div>

          {/* Paste CSV Import Section */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Paste Scheduled Items (CSV)
            </h3>

            {!showPasteImport ? (
              <button
                onClick={() => setShowPasteImport(true)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                ✏️ Paste CSV Data to Add Items
              </button>
            ) : pasteStep === 'input' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Paste CSV Data
                  </label>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Date,Description,Type,Amount,Account,Category,Recurrence&#10;2024-01-15,Rent,expense,1500.00,Checking,,monthly&#10;2024-01-20,Paycheck,income,3000.00,Checking,,biweekly"
                    rows={6}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClosePasteImport}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleParsePaste}
                    disabled={!pasteText.trim()}
                    className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    Preview
                  </button>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  <p><strong>Columns:</strong> Date, Description, Type, Amount, Account, Category, Recurrence</p>
                  <p>Type &amp; Category are optional (default: expense / none). Amount in dollars.</p>
                  <p>Auto-detects: commas, tabs, or semicolons. Handles quoted fields.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {pastePreview.filter((r) => r.valid).length} of {pastePreview.length} rows ready
                  </p>
                  <button
                    type="button"
                    onClick={() => { setPasteStep('input'); setPastePreview([]); }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit pasted data
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {pastePreview.map((row, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg border text-sm ${
                        row.valid ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 truncate">
                          {row.description || 'Unnamed'}
                        </span>
                        {!row.valid && (
                          <span className="text-xs text-red-600 ml-2 shrink-0">{row.error}</span>
                        )}
                      </div>
                      {row.valid && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {row.dateStr} • ${(row.amount / 100).toFixed(2)} • {row.type} • {row.recurrence}
                          {row.accountName ? ` • ${row.accountName}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClosePasteImport}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportPaste}
                    disabled={importingCsv || pastePreview.filter((r) => r.valid).length === 0}
                    className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importingCsv ? 'Importing...' : `Import ${pastePreview.filter((r) => r.valid).length} Items`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- CSV Export Helpers ----

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCSVDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---- Account Add/Edit Form ----

interface AccountFormProps {
  editingAccount: Account | null;
  onSave: (account: Account) => Promise<void>;
  onCancel: () => void;
}

function AccountForm({ editingAccount, onSave, onCancel }: AccountFormProps) {
  const [name, setName] = useState(editingAccount?.name ?? '');
  const [type, setType] = useState<Account['type']>(editingAccount?.type ?? 'checking');
  const [balance, setBalance] = useState(editingAccount ? String((editingAccount.currentBalance / 100).toFixed(2)) : '0');
  const [threshold, setThreshold] = useState(editingAccount ? String((editingAccount.lowBalanceThreshold / 100).toFixed(2)) : '100');
  const [color, setColor] = useState(editingAccount?.color ?? ACCOUNT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const now = new Date();
      const acct: Account = {
        id: editingAccount?.id ?? crypto.randomUUID(),
        name: name.trim() || 'Untitled',
        type,
        currentBalance: Math.round(parseFloat(balance) * 100) || 0,
        lowBalanceThreshold: Math.round(parseFloat(threshold) * 100) || 0,
        color,
        isActive: true,
        createdAt: editingAccount?.createdAt ?? now,
        updatedAt: now,
      };
      await onSave(acct);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-3 space-y-3 mt-2">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main Checking"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
        <div className="grid grid-cols-4 gap-1.5">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                type === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{ACCOUNT_ICONS[t]}</span>
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Low Threshold</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Color</label>
        <div className="flex gap-1.5">
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingAccount ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// ---- Paste CSV Import Types & Helpers ----

interface PastePreviewRow {
  dateStr: string;
  description: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // cents
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName: string;
  recurrence: ScheduledItem['recurrence'];
  valid: boolean;
  error?: string;
}

function parseScheduledCSV(text: string): PastePreviewRow[] {
  if (!text || !text.trim()) return [];

  const normalized = normalizeLineEndings(text);
  const delimiter = detectDelimiter(text);
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) return [];

  // Parse header to find column positions by name
  const headerCols = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/^"|"$/g, '').trim()
  );

  const dateIdx = headerCols.findIndex((h) => h.includes('date'));
  const descIdx = headerCols.findIndex((h) => h.includes('desc'));
  const typeIdx = headerCols.findIndex((h) => h === 'type');
  const amountIdx = headerCols.findIndex((h) => h.includes('amount'));
  const accountIdx = headerCols.findIndex((h) => h.includes('account'));
  const categoryIdx = headerCols.findIndex((h) => h.includes('category') || h.includes('cat'));
  const recurrenceIdx = headerCols.findIndex((h) => h.includes('recur') || h.includes('frequency'));

  // If no recognizable headers, assume positional order
  const usePositional = dateIdx === -1 && amountIdx === -1 && descIdx === -1;

  // We need account and category lookups, but those are async (DB calls).
  // For preview, we store names; actual IDs are resolved at import time.
  // However, to show account/category names in preview and resolve IDs at import,
  // we do a synchronous best-effort here. The real resolution happens in handleImportPaste.
  // For simplicity, we return preview rows with names and resolve IDs at import.

  const rows: PastePreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i], delimiter);

    if (cols.length < 3) {
      rows.push({
        dateStr: '', description: `Row ${i}`, type: 'expense', amount: 0,
        accountId: '', accountName: '', categoryName: '', recurrence: 'once',
        valid: false, error: `Not enough columns (got ${cols.length})`,
      });
      continue;
    }

    const dateStr = usePositional ? safeCell(cols, 0) : safeCell(cols, dateIdx >= 0 ? dateIdx : 0);
    const description = usePositional ? safeCell(cols, 1) : safeCell(cols, descIdx >= 0 ? descIdx : 1);
    const typeRaw = usePositional ? safeCell(cols, 2, 'expense') : safeCell(cols, typeIdx >= 0 ? typeIdx : 2, 'expense');
    const amountRaw = usePositional ? safeCell(cols, 3) : safeCell(cols, amountIdx >= 0 ? amountIdx : 3);
    const accountName = usePositional ? safeCell(cols, 4) : (accountIdx >= 0 ? safeCell(cols, accountIdx) : '');
    const categoryName = usePositional ? safeCell(cols, 5) : (categoryIdx >= 0 ? safeCell(cols, categoryIdx) : '');
    const recurrenceRaw = usePositional ? safeCell(cols, 6, 'once') : (recurrenceIdx >= 0 ? safeCell(cols, recurrenceIdx, 'once') : 'once');

    const type = (['income', 'expense', 'transfer'].includes(typeRaw.toLowerCase()) ? typeRaw.toLowerCase() : 'expense') as 'income' | 'expense' | 'transfer';
    const amount = dollarsToCents(amountRaw, NaN);
    const recurrence = (['once', 'weekly', 'biweekly', 'monthly'].includes(recurrenceRaw.toLowerCase()) ? recurrenceRaw.toLowerCase() : 'once') as ScheduledItem['recurrence'];

    let error: string | undefined;
    if (!dateStr) error = 'Missing date';
    else if (!description) error = 'Missing description';
    else if (isNaN(amount)) error = 'Invalid amount';

    rows.push({
      dateStr,
      description,
      type,
      amount: isNaN(amount) ? 0 : amount,
      accountId: '', // resolved at import
      accountName,
      categoryId: undefined,
      categoryName,
      recurrence,
      valid: !error,
      error,
    });
  }

  return rows;
}
