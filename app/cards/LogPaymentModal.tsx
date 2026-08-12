'use client';

import { useState, useEffect } from 'react';
import { useCards, useCashflow } from '@/lib/context';
import { formatCurrency } from '@/lib/calculations';
import type { PaymentRecommendation } from '@/lib/cardOptimization';

interface LogPaymentModalProps {
  open: boolean;
  cardId: string | null;
  recommendation?: PaymentRecommendation | null;
  onClose: () => void;
}

export function LogPaymentModal({ open, cardId, recommendation, onClose }: LogPaymentModalProps) {
  const { cards, recordCardPayment } = useCards();
  const { accounts } = useCashflow();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const card = cards.find((c) => c.id === cardId);
  const activeAccounts = accounts.filter((a) => a.isActive);

  useEffect(() => {
    if (!open) return;
    // Default amount to recommendation, date to today, account to card's paymentAccountId
    setAmount(recommendation ? (recommendation.recommendedPayment / 100).toFixed(2) : '');
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);
    setAccountId(card?.paymentAccountId ?? '');
    setError(null);
  }, [open, cardId, recommendation, card]);

  if (!open || !card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (amountCents > card.balance) {
      setError(`Payment exceeds current balance of ${formatCurrency(card.balance)}`);
      return;
    }

    setSaving(true);
    try {
      const parsedDate = date ? new Date(date + 'T00:00:00') : new Date();
      await recordCardPayment(card.id, amountCents, parsedDate, accountId || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment');
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
            <div>
              <h2 className="text-lg font-bold text-gray-900">Log Payment</h2>
              <p className="text-sm text-gray-500">
                {card.name} — Balance: {formatCurrency(card.balance)}
              </p>
            </div>
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

          {/* Recommendation banner */}
          {recommendation && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-800 font-medium">
                💡 {recommendation.reason}
              </p>
              <p className="text-xs text-green-700 mt-1">
                Recommended: {formatCurrency(recommendation.recommendedPayment)} by{' '}
                {recommendation.recommendedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
                {recommendation.interestSaved > 0 && (
                  <> — saves ~{formatCurrency(recommendation.interestSaved)} in interest</>
                )}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Payment Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
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
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAmount((card.minimumPayment / 100).toFixed(2))}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Min: {formatCurrency(card.minimumPayment)}
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((card.balance / 100).toFixed(2))}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Full: {formatCurrency(card.balance)}
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
              />
            </div>

            {/* From account */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                From Account
              </label>
              <p className="text-xs text-gray-500 mb-2">Which account is the payment coming from?</p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setAccountId('')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    !accountId
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-gray-400">No account (manual entry)</span>
                </button>
                {activeAccounts.map((acct) => (
                  <button
                    key={acct.id}
                    type="button"
                    onClick={() => setAccountId(acct.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      accountId === acct.id
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
                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Log Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
