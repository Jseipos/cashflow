'use client';

import { useState } from 'react';
import { AppProviders, useWishlist, useCashflow } from '@/lib/context';
import { WishlistList } from './WishlistList';
import { WishlistForm } from './WishlistForm';
import { formatCurrency } from '@/lib/calculations';
import type { WishlistItem } from '@/lib/types';

function WishlistPageInner() {
  const { items, loading, error } = useWishlist();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<WishlistItem | null>(null);

  const activeItems = items.filter((i) => i.isActive && !i.isPurchased);
  const purchasedItems = items.filter((i) => i.isPurchased);
  const totalCost = activeItems.reduce((s, i) => s + i.estimatedCost, 0);
  const totalSaved = activeItems.reduce((s, i) => s + i.savedSoFar, 0);
  const totalMonthlySavings = activeItems.reduce((s, i) => s + i.monthlySavings, 0);

  const handleEdit = (item: WishlistItem) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Wish List</h1>
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + Add Item
          </button>
        </div>
      </header>

      {/* Summary */}
      {activeItems.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 py-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Total Cost</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Saved</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(totalSaved)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Monthly</div>
                <div className="text-lg font-bold text-blue-600">{formatCurrency(totalMonthlySavings)}</div>
              </div>
            </div>
            {/* Overall progress */}
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${totalCost > 0 ? Math.min(100, (totalSaved / totalCost) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">⭐</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">No wishlist items</h2>
            <p className="text-sm text-gray-400 mb-6">
              Add things you want to save for. Monthly savings will sync to your calendar.
            </p>
            <button
              onClick={handleAdd}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          <>
            <WishlistList items={activeItems} onEdit={handleEdit} />

            {purchasedItems.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
                  Purchased 🎉
                </h3>
                <WishlistList items={purchasedItems} onEdit={handleEdit} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Form modal */}
      <WishlistForm
        open={formOpen}
        editItem={editItem}
        onClose={() => {
          setFormOpen(false);
          setEditItem(null);
        }}
      />
    </div>
  );
}

export default function WishlistPage() {
  return (
    <AppProviders>
      <WishlistPageInner />
    </AppProviders>
  );
}
