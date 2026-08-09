'use client';

import { format } from 'date-fns';
import type { DayBalance, ScheduledItem } from '@/lib/types';
import { formatCurrency } from '@/lib/calculations';
import { useCashflow, useCategories } from '@/lib/context';

interface DayDetailPanelProps {
  dayBalance: DayBalance | null;
  onClose: () => void;
  onAddItem: (date: Date) => void;
  onEditItem: (item: ScheduledItem) => void;
}

export function DayDetailPanel({
  dayBalance,
  onClose,
  onAddItem,
  onEditItem,
}: DayDetailPanelProps) {
  const { deleteScheduledItem, selectedAccount } = useCashflow();
  const { categories } = useCategories();

  if (!dayBalance) return null;

  const { date, balance, items, isLowBalance, isBelowZero } = dayBalance;

  // Build a quick lookup map for categories
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const handleDelete = async (scheduledItemId: string) => {
    if (confirm('Delete this scheduled item? This will remove all future occurrences.')) {
      await deleteScheduledItem(scheduledItemId);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {format(date, 'EEEE, MMM d')}
              </h2>
              <p className="text-sm text-gray-500">{format(date, 'yyyy')}</p>
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

          {/* Balance summary */}
          <div className="mt-3 flex items-center gap-3">
            <div className={`text-2xl font-bold ${
              isBelowZero ? 'text-red-600' : isLowBalance ? 'text-amber-600' : 'text-green-700'
            }`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-sm text-gray-500">projected balance</div>
            {isBelowZero && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                Overdraft risk
              </span>
            )}
            {isLowBalance && !isBelowZero && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                Low balance
              </span>
            )}
          </div>
        </div>

        {/* Scheduled items */}
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Scheduled
            </h3>
            <button
              onClick={() => onAddItem(date)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No scheduled items for this day.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const category = item.categoryId ? categoryMap.get(item.categoryId) : null;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.type === 'income' ? 'bg-green-500' : item.type === 'transfer' ? 'bg-indigo-500' : 'bg-red-500'
                      }`} />
                      <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {category && (
                          <span className="text-base leading-none" title={category.name}>
                            {category.icon}
                          </span>
                        )}
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.description}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 capitalize">
                        {item.type}{category ? ` · ${category.name}` : ''}
                      </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-semibold ${
                        item.type === 'income' ? 'text-green-600' : item.type === 'transfer' ? 'text-indigo-600' : 'text-red-600'
                      }`}>
                        {item.type === 'income' ? '+' : item.type === 'transfer' ? '↔' : '-'}{formatCurrency(item.amount)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            // Find the original scheduled item to edit
                            const original = { id: item.scheduledItemId } as ScheduledItem;
                            onEditItem(original);
                          }}
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                          aria-label="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.scheduledItemId)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-500"
                          aria-label="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Threshold info */}
        {selectedAccount && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Low balance threshold: {formatCurrency(selectedAccount.lowBalanceThreshold)}
          </div>
        )}
      </div>
    </>
  );
}
