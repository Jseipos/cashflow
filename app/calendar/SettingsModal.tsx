'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCashflow } from '@/lib/context';
import { formatCurrency } from '@/lib/calculations';
import { getDB, getAllScheduledItems, getAllAccounts, getAllCreditCards, getAllCategories } from '@/lib/db';
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
  const { accounts, selectedAccount, updateAccount, addAccount, deleteAccount, scheduledItems } = useCashflow();

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
        </div>
      </div>
    </div>
  );
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

// ---- CSV Helpers ----

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
