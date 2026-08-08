'use client';

import { formatCurrency } from '@/lib/calculations';
import { useWishlist } from '@/lib/context';
import type { WishlistItem } from '@/lib/types';

interface WishlistListProps {
  items: WishlistItem[];
  onEdit: (item: WishlistItem) => void;
}

export function WishlistList({ items, onEdit }: WishlistListProps) {
  const { deleteItem, updateItem } = useWishlist();

  const handleDelete = async (item: WishlistItem) => {
    if (window.confirm(`Delete "${item.name}"? This will also remove its savings from the calendar.`)) {
      await deleteItem(item.id);
    }
  };

  const handleTogglePurchased = async (item: WishlistItem) => {
    await updateItem({
      ...item,
      isPurchased: !item.isPurchased,
      updatedAt: new Date(),
    });
  };

  return (
    <div className="space-y-3 pb-4">
      {items.map((item) => {
        const progress = item.estimatedCost > 0
          ? Math.min(100, (item.savedSoFar / item.estimatedCost) * 100)
          : 0;
        const remaining = item.estimatedCost - item.savedSoFar;
        const monthsToGo = item.monthlySavings > 0
          ? Math.ceil(remaining / item.monthlySavings)
          : null;

        return (
          <div
            key={item.id}
            className={`bg-white rounded-xl border p-4 ${
              item.isPurchased
                ? 'border-green-200 bg-green-50/50'
                : item.isActive
                  ? 'border-gray-200'
                  : 'border-gray-100 opacity-50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">
                  {item.isPurchased ? '✅' : '⭐'}
                </span>
                <div>
                  <h3 className={`font-semibold ${
                    item.isPurchased ? 'text-green-700 line-through' : 'text-gray-900'
                  }`}>
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Priority #{item.priority}
                    {item.targetDate
                      ? ` • Target: ${new Date(item.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!item.isPurchased && (
                  <button
                    onClick={() => handleTogglePurchased(item)}
                    className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"
                    aria-label={`Mark ${item.name} as purchased`}
                    title="Mark as purchased"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => onEdit(item)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                  aria-label={`Edit ${item.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  aria-label={`Delete ${item.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-2">
              <div>
                <div className="text-xs text-gray-400">Cost</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(item.estimatedCost)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Saved</div>
                <div className="text-sm font-bold text-green-700">{formatCurrency(item.savedSoFar)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Monthly</div>
                <div className="text-sm font-bold text-blue-600">{formatCurrency(item.monthlySavings)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.isPurchased ? 'bg-green-500' :
                    progress >= 75 ? 'bg-green-500' :
                    progress >= 40 ? 'bg-blue-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${
                progress >= 100 ? 'text-green-600' : 'text-gray-500'
              }`}>
                {progress.toFixed(0)}%
              </span>
            </div>

            {!item.isPurchased && monthsToGo !== null && monthsToGo > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                {monthsToGo} month{monthsToGo !== 1 ? 's' : ''} to go at current savings rate
              </div>
            )}
            {!item.isPurchased && remaining <= 0 && (
              <div className="text-xs text-green-600 font-medium mt-1">
                Fully saved! 🎉
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
