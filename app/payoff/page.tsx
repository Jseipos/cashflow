'use client';

import { useState, useMemo } from 'react';
import { AppProviders, useCards, useCashflow } from '@/lib/context';
import { calculatePayoff, compareStrategies } from '@/lib/payoff';
import { formatCurrency } from '@/lib/calculations';
import { format, addMonths } from 'date-fns';
import type { PayoffPlanResult } from '@/lib/types';

function PayoffPageInner() {
  const { cards, loading } = useCards();
  const { selectedAccount, addScheduledItem, deleteScheduledItem, scheduledItems } = useCashflow();

  const [extraPayment, setExtraPayment] = useState(0); // dollars
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [showComparison, setShowComparison] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const activeCards = cards.filter((c) => c.isActive && c.balance > 0);
  const totalBalance = activeCards.reduce((s, c) => s + c.balance, 0);
  const totalMinPayments = activeCards.reduce((s, c) => s + c.minimumPayment, 0);
  const extraCents = Math.round(extraPayment * 100);

  const result = useMemo(() => {
    if (activeCards.length === 0) return null;
    return calculatePayoff(activeCards, extraCents, strategy);
  }, [activeCards, extraCents, strategy]);

  const comparison = useMemo(() => {
    if (!showComparison || activeCards.length === 0) return null;
    return compareStrategies(activeCards, extraCents);
  }, [showComparison, activeCards, extraCents]);

  const handleApplyPlan = async () => {
    if (!result || !selectedAccount) return;
    setApplying(true);

    try {
      // Remove existing payoff plan items
      const existingPayoffItems = scheduledItems.filter((i) => i.sourceType === 'payoff');
      for (const item of existingPayoffItems) {
        await deleteScheduledItem(item.id);
      }

      // Create new payoff scheduled items
      const now = new Date();
      for (const cardResult of result.cards) {
        if (cardResult.payments.length === 0) continue;

        const card = activeCards.find((c) => c.id === cardResult.cardId);
        if (!card) continue;

        const firstPayment = cardResult.payments[0];
        const totalPayment = firstPayment.payment;

        await addScheduledItem({
          id: crypto.randomUUID(),
          accountId: selectedAccount.id,
          type: 'expense',
          amount: totalPayment,
          description: `${card.name} payoff payment`,
          recurrence: 'monthly',
          startDate: getNextDueDate(card.dueDate),
          endDate: cardResult.payoffDate,
          isActive: true,
          lastProcessedDate: null,
          sourceId: card.id,
          sourceType: 'payoff',
          createdAt: now,
          updatedAt: now,
        });
      }

      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900">Payoff Calculator</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
        {activeCards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🎯</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">No cards to pay off</h2>
            <p className="text-sm text-gray-400">
              Add credit cards with balances to calculate your payoff strategy.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Total Debt</div>
                  <div className="text-xl font-bold text-red-600">{formatCurrency(totalBalance)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Min Payments</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(totalMinPayments)}/mo</div>
                </div>
              </div>
            </div>

            {/* Strategy toggle */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStrategy('avalanche')}
                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                      strategy === 'avalanche'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ⛰️ Avalanche
                    <div className="text-xs mt-0.5 opacity-75">Highest APR first</div>
                  </button>
                  <button
                    onClick={() => setStrategy('snowball')}
                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                      strategy === 'snowball'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ⛄ Snowball
                    <div className="text-xs mt-0.5 opacity-75">Lowest balance first</div>
                  </button>
                </div>
              </div>

              {/* Extra payment slider */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Extra Monthly Payment
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="w-20 text-right">
                    <span className="text-lg font-bold text-blue-600">${extraPayment}</span>
                    <span className="text-xs text-gray-400">/mo</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>$0</span>
                  <span>$5,000</span>
                </div>
              </div>

              {/* Compare toggle */}
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {showComparison ? 'Hide Comparison' : 'Compare Strategies'}
              </button>
            </div>

            {/* Comparison view */}
            {comparison && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Strategy Comparison</h3>
                <div className="grid grid-cols-2 gap-4">
                  <StrategyCard
                    label="⛰️ Avalanche"
                    result={comparison.avalanche}
                    highlight={comparison.avalanche.totalInterest <= comparison.snowball.totalInterest}
                  />
                  <StrategyCard
                    label="⛄ Snowball"
                    result={comparison.snowball}
                    highlight={comparison.snowball.totalInterest < comparison.avalanche.totalInterest}
                  />
                </div>
                {comparison.avalanche.totalInterest !== comparison.snowball.totalInterest && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    {comparison.avalanche.totalInterest < comparison.snowball.totalInterest
                      ? `Avalanche saves ${formatCurrency(comparison.snowball.totalInterest - comparison.avalanche.totalInterest)} in interest`
                      : `Snowball saves ${formatCurrency(comparison.avalanche.totalInterest - comparison.snowball.totalInterest)} in interest`}
                  </p>
                )}
              </div>
            )}

            {/* Results */}
            {result && (
              <>
                {/* Debt-free date banner */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white text-center">
                  <div className="text-xs uppercase tracking-wide opacity-75">Debt-Free Date</div>
                  <div className="text-2xl font-bold">
                    {format(result.debtFreeDate, 'MMMM yyyy')}
                  </div>
                  <div className="text-sm opacity-75 mt-1">
                    {result.totalMonths} months • {formatCurrency(result.totalInterest)} total interest
                  </div>
                </div>

                {/* Per-card results */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-gray-900">Payoff Order</h3>
                  {result.cards.map((cardResult, index) => (
                    <div
                      key={cardResult.cardId}
                      className="bg-white rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="font-semibold text-gray-900">{cardResult.cardName}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {format(cardResult.payoffDate, 'MMM yyyy')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Balance</span>
                          <div className="font-medium text-gray-900">{formatCurrency(cardResult.startingBalance)}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Interest</span>
                          <div className="font-medium text-red-600">{formatCurrency(cardResult.totalInterestPaid)}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Months</span>
                          <div className="font-medium text-gray-900">{cardResult.payoffMonth + 1}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Apply plan button */}
                <button
                  onClick={handleApplyPlan}
                  disabled={applying}
                  className={`w-full px-4 py-3.5 rounded-xl font-semibold text-white transition-colors ${
                    applied
                      ? 'bg-green-600'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {applying ? 'Applying...' : applied ? '✓ Plan Applied to Calendar' : 'Apply Plan to Calendar'}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  This creates recurring payment items on your calendar for each card.
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StrategyCard({ label, result, highlight }: {
  label: string;
  result: PayoffPlanResult;
  highlight: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${
      highlight ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="text-xs font-semibold mb-1">{label}</div>
      <div className="text-sm font-bold text-gray-900">
        {format(result.debtFreeDate, 'MMM yyyy')}
      </div>
      <div className="text-xs text-gray-500">
        {result.totalMonths}mo • {formatCurrency(result.totalInterest)} interest
      </div>
      {highlight && (
        <div className="text-xs text-green-600 font-medium mt-1">✓ Best strategy</div>
      )}
    </div>
  );
}

function getNextDueDate(dueDay: number): Date {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (thisMonth >= now) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
}

export default function PayoffPage() {
  return (
    <AppProviders>
      <PayoffPageInner />
    </AppProviders>
  );
}
