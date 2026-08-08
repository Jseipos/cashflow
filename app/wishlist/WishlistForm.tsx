'use client';

import { useState, useEffect } from 'react';
import { useWishlist, useCashflow } from '@/lib/context';
import type { WishlistItem } from '@/lib/types';

interface WishlistFormProps {
  open: boolean;
  editItem: WishlistItem | null;
  onClose: () => void;
}

export function WishlistForm({ open, editItem, onClose }: WishlistFormProps) {
  const { addItem, updateItem } = useWishlist();
  const { account, addScheduledItem, updateScheduledItem, deleteScheduledItem, scheduledItems } = useCashflow();

  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [priority, setPriority] = useState('1');
  const [monthlySavings, setMonthlySavings] = useState('');
  const [savedSoFar, setSavedSoFar] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [savingsDay, setSavingsDay] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setName(editItem.name);
      setCost((editItem.estimatedCost / 100).toFixed(2));
      setPriority(String(editItem.priority));
      setMonthlySavings((editItem.monthlySavings / 100).toFixed(2));
      setSavedSoFar((editItem.savedSoFar / 100).toFixed(2));
      setTargetDate(
        editItem.targetDate
          ? new Date(editItem.targetDate).toISOString().split('T')[0]
          : ''
      );
      setSavingsDay(String(editItem.savingsDay));
    } else {
      setName('');
      setCost('');
      setPriority('1');
      setMonthlySavings('');
      setSavedSoFar('0');
      setTargetDate('');
      setSavingsDay('1');
    }
    setError(null);
  }, [open, editItem]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Enter an item name'); return; }
    const costCents = Math.round(parseFloat(cost) * 100);
    if (isNaN(costCents) || costCents <= 0) { setError('Enter a valid cost'); return; }
    const priorityNum = parseInt(priority);
    if (isNaN(priorityNum) || priorityNum < 1) { setError('Priority must be 1 or higher'); return; }
    const savingsCents = Math.round(parseFloat(monthlySavings) * 100);
    if (isNaN(savingsCents) || savingsCents < 0) { setError('Enter a valid monthly savings amount'); return; }
    const savedCents = Math.round(parseFloat(savedSoFar) * 100);
    if (isNaN(savedCents) || savedCents < 0) { setError('Enter a valid saved amount'); return; }
    const dayNum = parseInt(savingsDay);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 28) { setError('Savings day must be 1-28'); return; }

    setSaving(true);
    try {
      const now = new Date();
      const item: WishlistItem = {
        id: editItem?.id ?? crypto.randomUUID(),
        name: name.trim(),
        estimatedCost: costCents,
        priority: priorityNum,
        monthlySavings: savingsCents,
        targetDate: targetDate ? new Date(targetDate + 'T12:00:00') : null,
        savedSoFar: savedCents,
        isActive: editItem?.isActive ?? true,
        isPurchased: editItem?.isPurchased ?? false,
        savingsDay: dayNum,
        createdAt: editItem?.createdAt ?? now,
        updatedAt: now,
      };

      if (editItem) {
        await updateItem(item);
      } else {
        await addItem(item);
      }

      // Sync savings to calendar
      if (account && savingsCents > 0) {
        // Remove old scheduled item for this wishlist item if editing
        if (editItem) {
          const oldItem = scheduledItems.find(
            (i) => i.sourceId === item.id && i.sourceType === 'wishlist'
          );
          if (oldItem) {
            await updateScheduledItem({
              ...oldItem,
              amount: savingsCents,
              description: `Save for ${item.name}`,
              startDate: getNextSavingsDate(dayNum),
              updatedAt: now,
            });
          } else {
            await createSavingsItem(item, account.id, addScheduledItem);
          }
        } else {
          await createSavingsItem(item, account.id, addScheduledItem);
        }
      } else if (account && savingsCents === 0 && editItem) {
        // If savings set to 0, remove the scheduled item
        const oldItem = scheduledItems.find(
          (i) => i.sourceId === item.id && i.sourceType === 'wishlist'
        );
        if (oldItem) {
          await deleteScheduledItem(oldItem.id);
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editItem ? 'Edit Item' : 'Add Wishlist Item'}
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
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Item Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New laptop"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                autoFocus
              />
            </div>

            {/* Cost & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Estimated Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={cost} onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Priority
                </label>
                <input
                  type="number" inputMode="numeric" min="1"
                  value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Monthly Savings & Saved So Far */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Monthly Savings
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={monthlySavings} onChange={(e) => setMonthlySavings(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Already Saved
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={savedSoFar} onChange={(e) => setSavedSoFar(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Target Date & Savings Day */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Target Date <span className="text-gray-400 normal-case">(optional)</span>
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Savings Day
                </label>
                <input
                  type="number" inputMode="numeric" min="1" max="28"
                  value={savingsDay} onChange={(e) => setSavingsDay(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">Day of month (1-28)</p>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}

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
  );
}

// Helper: get the next occurrence of a savings day
function getNextSavingsDate(day: number): Date {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  if (thisMonth >= now) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, day);
}

// Helper: create a scheduled item for wishlist savings
async function createSavingsItem(
  item: WishlistItem,
  accountId: string,
  addItem: (item: any) => Promise<void>,
) {
  const now = new Date();
  await addItem({
    id: crypto.randomUUID(),
    accountId,
    type: 'expense',
    amount: item.monthlySavings,
    description: `Save for ${item.name}`,
    recurrence: 'monthly',
    startDate: getNextSavingsDate(item.savingsDay),
    endDate: null,
    isActive: true,
    lastProcessedDate: null,
    sourceId: item.id,
    sourceType: 'wishlist',
    createdAt: now,
    updatedAt: now,
  });
}
