'use client';

import { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';
import type { ScheduledItem, ItemType, RecurrenceType } from '@/lib/types';
import { useCashflow, useCategories, useCards } from '@/lib/context';
import { CategoryPicker } from '@/app/components/CategoryPicker';
import { formatCurrency } from '@/lib/calculations';

interface AddScheduledItemModalProps {
  open: boolean;
  initialDate: Date | null;
  editItem: ScheduledItem | null;
  onClose: () => void;
}

export function AddScheduledItemModal({
  open,
  initialDate,
  editItem,
  onClose,
}: AddScheduledItemModalProps) {
  const { accounts, selectedAccountId, addScheduledItem, updateScheduledItem } = useCashflow();
  const { categories } = useCategories();
  const { cards, recordCardExpense } = useCards();

  const [type, setType] = useState<ItemType>('expense');
  const [amount, setAmount] = useState<string>(''); // dollars input
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(''); // yyyy-MM-dd
  const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [cardId, setCardId] = useState<string>(''); // credit card as payment source
  const [toAccountId, setToAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (!open) return;

    if (editItem) {
      setType(editItem.type);
      setAmount(String(Math.abs(editItem.amount / 100)));
      setDescription(editItem.description);
      setDate(format(editItem.startDate, 'yyyy-MM-dd'));
      setRecurrence(editItem.recurrence);
      setCategoryId(editItem.categoryId ?? null);
      setAccountId(editItem.accountId);
      setToAccountId(editItem.toAccountId ?? '');
    } else {
      setType('expense');
      setAmount('');
      setDescription('');
      setDate(format(initialDate ?? new Date(), 'yyyy-MM-dd'));
      setRecurrence('once');
      setCategoryId(null);
      setAccountId(selectedAccountId ?? accounts[0]?.id ?? '');
      setCardId('');
      setToAccountId('');
    }
    setError(null);
  }, [open, editItem, initialDate, selectedAccountId, accounts]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountId && !cardId) {
      setError('Select an account or credit card');
      return;
    }

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (!description.trim()) {
      setError('Enter a description');
      return;
    }

    if (type === 'transfer' && !toAccountId) {
      setError('Select a destination account for the transfer');
      return;
    }

    if (type === 'transfer' && toAccountId === accountId) {
      setError('Cannot transfer to the same account');
      return;
    }

    const parsedDate = parse(date, 'yyyy-MM-dd', new Date());
    if (isNaN(parsedDate.getTime())) {
      setError('Enter a valid date');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const item: ScheduledItem = {
        id: editItem?.id ?? crypto.randomUUID(),
        accountId: cardId ? (accounts[0]?.id ?? '') : accountId, // card expenses still need an account for the ledger
        type,
        amount: amountCents,
        description: description.trim(),
        categoryId: categoryId ?? undefined,
        recurrence,
        startDate: parsedDate,
        endDate: null,
        isActive: true,
        lastProcessedDate: null,
        sourceId: cardId || undefined,
        sourceType: cardId ? 'card' : undefined,
        createdAt: editItem?.createdAt ?? now,
        updatedAt: now,
      };

      if (type === 'transfer') {
        item.toAccountId = toAccountId;
      }

      if (editItem) {
        await updateScheduledItem(item);
      } else {
        await addScheduledItem(item);
      }

      // If a credit card was selected as payment source, record the card transaction
      if (cardId && type === 'expense') {
        await recordCardExpense(cardId, amountCents, description.trim(), parsedDate, item.id);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const availableToAccounts = accounts.filter((a) => a.id !== accountId);
  const activeCards = cards.filter((c) => c.isActive);
  const showCardOption = type === 'expense' && activeCards.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editItem ? 'Edit Scheduled Item' : 'Add Scheduled Item'}
              </h2>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Type
                </label>
                <div className={type === 'transfer' ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      type === 'expense'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    💸 Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      type === 'income'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    💰 Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('transfer')}
                    className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      type === 'transfer'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🔄 Transfer
                  </button>
                </div>
              </div>

              {/* Account / Card selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  {type === 'transfer' ? 'From Account' : 'Paid With'}
                </label>
                {showCardOption && (
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => { setCardId(''); setAccountId(selectedAccountId ?? accounts[0]?.id ?? ''); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !cardId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Account
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCardId(activeCards[0]?.id ?? ''); setAccountId(''); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cardId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Credit Card
                    </button>
                  </div>
                )}
                {!cardId ? (
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                  >
                    <option value="">Select a card...</option>
                    {activeCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (bal: {formatCurrency(c.balance)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Transfer destination */}
              {type === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    To Account
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                  >
                    <option value="">Select destination...</option>
                    {availableToAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                    autoFocus
                  />
                </div>
                {amount && !isNaN(parseFloat(amount)) && (
                  <p className="text-xs text-gray-400 mt-1">
                    = {formatCurrency(Math.round(parseFloat(amount) * 100))}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Rent, Paycheck, Groceries"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Repeat
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['once', 'weekly', 'biweekly', 'monthly'] as RecurrenceType[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrence(r)}
                      className={`px-2 py-2 rounded-lg font-medium text-xs transition-colors capitalize ${
                        recurrence === r
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {r === 'biweekly' ? 'Bi-weekly' : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              {type !== 'transfer' && (
                <CategoryPicker
                  categories={categories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                />
              )}

              {/* Error */}
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
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
                  {saving ? 'Saving...' : editItem ? 'Update' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
