'use client';

import { formatCurrency } from '@/lib/calculations';
import { useCards } from '@/lib/context';
import type { CreditCard } from '@/lib/types';

interface CardListProps {
  cards: CreditCard[];
  onEdit: (card: CreditCard) => void;
}

export function CardList({ cards, onEdit }: CardListProps) {
  const { deleteCard } = useCards();

  const handleDelete = async (card: CreditCard) => {
    if (window.confirm(`Delete "${card.name}"? This will also remove its scheduled payments from the calendar.`)) {
      await deleteCard(card.id);
    }
  };

  const sorted = [...cards].sort((a, b) => {
    // Active first, then by balance descending
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.balance - a.balance;
  });

  return (
    <div className="space-y-3 pb-4">
      {sorted.map((card) => {
        const utilization = card.creditLimit > 0
          ? (card.balance / card.creditLimit) * 100
          : 0;

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
                <div className="text-sm font-bold text-gray-900">{formatCurrency(card.balance)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">APR</div>
                <div className="text-sm font-bold text-gray-900">{card.apr.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Min Payment</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(card.minimumPayment)}</div>
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
          </div>
        );
      })}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
