'use client';

import { useState, useEffect } from 'react';
import { useCards, useCashflow } from '@/lib/context';
import type { CreditCard } from '@/lib/types';

const CARD_COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

interface CardFormProps {
  open: boolean;
  editCard: CreditCard | null;
  onClose: () => void;
}

export function CardForm({ open, editCard, onClose }: CardFormProps) {
  const { addCard, updateCard } = useCards();
  const { accounts, selectedAccount, addScheduledItem, updateScheduledItem, scheduledItems } = useCashflow();

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDate, setStatementDate] = useState('1');
  const [dueDate, setDueDate] = useState('15');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editCard) {
      setName(editCard.name);
      setBalance((editCard.balance / 100).toFixed(2));
      setApr(String(editCard.apr));
      setMinPayment((editCard.minimumPayment / 100).toFixed(2));
      setCreditLimit((editCard.creditLimit / 100).toFixed(2));
      setStatementDate(String(editCard.statementDate));
      setDueDate(String(editCard.dueDate));
      setColor(editCard.color);
    } else {
      setName('');
      setBalance('');
      setApr('');
      setMinPayment('');
      setCreditLimit('');
      setStatementDate('1');
      setDueDate('15');
      setColor(CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)]);
    }
    // Default payment account to selected account or first available
    const defaultAcct = selectedAccount?.id ?? accounts[0]?.id ?? '';
    setPaymentAccountId(defaultAcct);
    setError(null);
  }, [open, editCard, selectedAccount, accounts]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Enter a card name'); return; }
    const balanceCents = Math.round(parseFloat(balance) * 100);
    if (isNaN(balanceCents) || balanceCents < 0) { setError('Enter a valid balance'); return; }
    const aprNum = parseFloat(apr);
    if (isNaN(aprNum) || aprNum < 0 || aprNum > 100) { setError('Enter a valid APR (0-100)'); return; }
    const minCents = Math.round(parseFloat(minPayment) * 100);
    if (isNaN(minCents) || minCents < 0) { setError('Enter a valid minimum payment'); return; }
    const limitCents = Math.round(parseFloat(creditLimit) * 100);
    if (isNaN(limitCents) || limitCents < 0) { setError('Enter a valid credit limit'); return; }
    const stmtDay = parseInt(statementDate);
    const dueDay = parseInt(dueDate);
    if (isNaN(stmtDay) || stmtDay < 1 || stmtDay > 31) { setError('Statement date must be 1-31'); return; }
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) { setError('Due date must be 1-31'); return; }

    setSaving(true);
    try {
      const now = new Date();
      const card: CreditCard = {
        id: editCard?.id ?? crypto.randomUUID(),
        name: name.trim(),
        balance: balanceCents,
        apr: aprNum,
        minimumPayment: minCents,
        creditLimit: limitCents,
        statementDate: stmtDay,
        dueDate: dueDay,
        color,
        isActive: editCard?.isActive ?? true,
        createdAt: editCard?.createdAt ?? now,
        updatedAt: now,
      };

      if (editCard) {
        await updateCard(card);
      } else {
        await addCard(card);
      }

      // Sync minimum payment to calendar
      const paymentAccount = accounts.find((a) => a.id === paymentAccountId) ?? selectedAccount;
      if (paymentAccount) {
        // Remove old scheduled item for this card if editing
        if (editCard) {
          const oldItem = scheduledItems.find(
            (i) => i.sourceId === card.id && i.sourceType === 'card'
          );
          if (oldItem) {
            // Update the existing item
            await updateScheduledItem({
              ...oldItem,
              amount: minCents,
              description: `${card.name} min payment`,
              startDate: getNextDueDate(dueDay),
              updatedAt: now,
            });
          } else {
            await createMinPaymentItem(card, paymentAccount.id, addScheduledItem);
          }
        } else {
          await createMinPaymentItem(card, paymentAccount.id, addScheduledItem);
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
              {editCard ? 'Edit Card' : 'Add Credit Card'}
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
                Card Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chase Sapphire"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                autoFocus
              />
            </div>

            {/* Balance & Limit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={balance} onChange={(e) => setBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Credit Limit
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* APR & Min Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  APR %
                </label>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0" max="100"
                  value={apr} onChange={(e) => setApr(e.target.value)}
                  placeholder="24.99"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Min Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={minPayment} onChange={(e) => setMinPayment(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Statement Day
                </label>
                <input
                  type="number" inputMode="numeric" min="1" max="31"
                  value={statementDate} onChange={(e) => setStatementDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Due Day
                </label>
                <input
                  type="number" inputMode="numeric" min="1" max="31"
                  value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                />
              </div>
            </div>

            {/* Payment Account */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Payment Account
              </label>
              <p className="text-xs text-gray-500 mb-2">Which account do payments come from?</p>
              <div className="space-y-1.5">
                {accounts.filter((a) => a.isActive).map((acct) => (
                  <button
                    key={acct.id}
                    type="button"
                    onClick={() => setPaymentAccountId(acct.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      paymentAccountId === acct.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: acct.color }}
                    />
                    <span>{acct.name}</span>
                    <span className="text-xs text-gray-400 ml-auto capitalize">{acct.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Color
              </label>
              <div className="flex gap-2">
                {CARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
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
                {saving ? 'Saving...' : editCard ? 'Update' : 'Add Card'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Helper: get the next occurrence of a due date
function getNextDueDate(dueDay: number): Date {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (thisMonth >= now) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
}

// Helper: create a scheduled item for a card's minimum payment
async function createMinPaymentItem(
  card: CreditCard,
  accountId: string,
  addItem: (item: import('@/lib/types').ScheduledItem) => Promise<void>,
) {
  const now = new Date();
  await addItem({
    id: crypto.randomUUID(),
    accountId,
    type: 'expense',
    amount: card.minimumPayment,
    description: `${card.name} min payment`,
    recurrence: 'monthly',
    startDate: getNextDueDate(card.dueDate),
    endDate: null,
    isActive: true,
    lastProcessedDate: null,
    sourceId: card.id,
    sourceType: 'card',
    createdAt: now,
    updatedAt: now,
  });
}
