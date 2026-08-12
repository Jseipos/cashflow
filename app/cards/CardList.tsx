'use client';

import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { useCards } from '@/lib/context';
import { calculateOptimalPayment, getLiveBalance, type PaymentRecommendation } from '@/lib/cardOptimization';
import { LogPaymentModal } from './LogPaymentModal';
import type { CreditCard, CardTransaction } from '@/lib/types';

interface CardListProps {
  cards: CreditCard[];
  onEdit: (card: CreditCard) => void;
}

export function CardList({ cards, onEdit }: CardListProps) {
  const { deleteCard, cardTransactions } = useCards();
  const [paymentModalCardId, setPaymentModalCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const handleDelete = async (card: CreditCard) => {
    if (window.confirm(`Delete "${card.name}"? This will also remove its scheduled payments and transactions from the calendar.`)) {
      await deleteCard(card.id);
    }
  };

  // Group transactions by cardId for quick lookup
  const transactionsByCard = useMemo(() => {
    const map = new Map<string, CardTransaction[]>();
    for (const tx of cardTransactions) {
      const arr = map.get(tx.cardId) ?? [];
      arr.push(tx);
      map.set(tx.cardId, arr);
    }
    return map;
  }, [cardTransactions]);

  // Calculate recommendations for each card
  const recommendations = useMemo(() => {
    const now = new Date();
    const recs = new Map<string, PaymentRecommendation | null>();
    for (const card of cards) {
      const cardTxs = transactionsByCard.get(card.id) ?? [];
      const rec = calculateOptimalPayment(card, cardTxs, now);
      recs.set(card.id, rec);
    }
    return recs;
  }, [cards, transactionsByCard]);

  const sorted = [...cards].sort((a, b) => {
    // Active first, then by live balance descending
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const aBal = getLiveBalance(transactionsByCard.get(a.id) ?? []) || a.balance;
    const bBal = getLiveBalance(transactionsByCard.get(b.id) ?? []) || b.balance;
    return bBal - aBal;
  });

  return (
    <div className="space-y-3 pb-4">
      {sorted.map((card) => {
        const cardTxs = transactionsByCard.get(card.id) ?? [];
        const liveBalance = cardTxs.length > 0 ? getLiveBalance(cardTxs) : card.balance;
        const utilization = card.creditLimit > 0
          ? (liveBalance / card.creditLimit) * 100
          : 0;
        const availableCredit = card.creditLimit - liveBalance;
        const rec = recommendations.get(card.id);
        const recentTxs = [...cardTxs]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5);
        const isExpanded = expandedCardId === card.id;

        return (
          <div
            key={card.id}
            className={`bg-white rounded-xl border p-4 ${
              card.isActive ? 'border-gray-200' : 'border-gray-100 opacity-50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: card.color }}
                />
                <div>
                  <h3 className="font-semibold text-gray-900">{card.name}</h3>
                  <p className="text-xs text-gray-400">
                    Due on the {ordinal(card.dueDate)} • Statement on the {ordinal(card.statementDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(card)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                  aria-label={`Edit ${card.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(card)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  aria-label={`Delete ${card.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-2">
              <div>
                <div className="text-xs text-gray-400">Balance</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(liveBalance)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Available</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(availableCredit)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">APR</div>
                <div className="text-sm font-bold text-gray-900">{card.apr.toFixed(2)}%</div>
              </div>
            </div>

            {/* Utilization bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    utilization > 70 ? 'bg-red-500' :
                    utilization > 30 ? 'bg-amber-400' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, utilization)}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${
                utilization > 70 ? 'text-red-600' :
                utilization > 30 ? 'text-amber-600' : 'text-green-700'
              }`}>
                {utilization.toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              of {formatCurrency(card.creditLimit)} limit
            </div>

            {/* Payment Recommendation Banner */}
            {rec && card.isActive && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-2">
                  <span className="text-sm">💡</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-900 font-medium">
                      Pay {formatCurrency(rec.recommendedPayment)} by{' '}
                      {rec.recommendedDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {rec.reason}
                      {rec.interestSaved > 0 && (
                        <> Saves ~{formatCurrency(rec.interestSaved)} in interest.</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPaymentModalCardId(card.id)}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                >
                  Log Payment
                </button>
              </div>
            )}

            {/* Quick Log Payment button when no recommendation */}
            {!rec && card.isActive && liveBalance > 0 && (
              <button
                onClick={() => setPaymentModalCardId(card.id)}
                className="mt-3 w-full px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Log Payment
              </button>
            )}

            {/* Recent transactions toggle */}
            {recentTxs.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-2">
                <button
                  onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  {isExpanded ? '▼' : '▶'} Recent Transactions ({recentTxs.length})
                </button>
                {isExpanded && (
                  <div className="mt-2 space-y-1.5">
                    {recentTxs.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={tx.type === 'payment' ? 'text-green-600' : 'text-gray-600'}>
                            {tx.type === 'payment' ? '↓' : '↑'}
                          </span>
                          <span className="text-gray-700 truncate">{tx.description}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-400">
                            {new Date(tx.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className={`font-medium ${
                            tx.type === 'payment' ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {tx.type === 'payment' ? '-' : '+'}{formatCurrency(tx.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Log Payment Modal */}
      <LogPaymentModal
        open={paymentModalCardId !== null}
        cardId={paymentModalCardId}
        recommendation={paymentModalCardId ? recommendations.get(paymentModalCardId) : null}
        onClose={() => setPaymentModalCardId(null)}
      />
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
