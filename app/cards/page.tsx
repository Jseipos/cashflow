'use client';

import { useState } from 'react';
import { AppProviders, useCards } from '@/lib/context';
import { CardList } from './CardList';
import { CardForm } from './CardForm';
import { CSVImport } from './CSVImport';
import { formatCurrency } from '@/lib/calculations';
import type { CreditCard } from '@/lib/types';

function CardsPageInner() {
  const { cards, loading, error } = useCards();
  const [formOpen, setFormOpen] = useState(false);
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const activeCards = cards.filter((c) => c.isActive);
  const totalBalance = activeCards.reduce((s, c) => s + c.balance, 0);
  const totalLimit = activeCards.reduce((s, c) => s + c.creditLimit, 0);
  const totalMinPayments = activeCards.reduce((s, c) => s + c.minimumPayment, 0);
  const avgAPR = activeCards.length > 0
    ? activeCards.reduce((s, c) => s + c.apr, 0) / activeCards.length
    : 0;
  const overallUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  const handleEdit = (card: CreditCard) => {
    setEditCard(card);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditCard(null);
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
          <h1 className="text-lg font-bold text-gray-900">Credit Cards</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Import CSV
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              + Add Card
            </button>
          </div>
        </div>
      </header>

      {/* Summary */}
      {activeCards.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 py-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Total Balance</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totalBalance)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Min Payments</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totalMinPayments)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Avg APR</div>
                <div className="text-lg font-bold text-gray-900">{avgAPR.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Utilization</div>
                <div className={`text-lg font-bold ${
                  overallUtilization > 70 ? 'text-red-600' :
                  overallUtilization > 30 ? 'text-amber-600' : 'text-green-700'
                }`}>
                  {overallUtilization.toFixed(0)}%
                </div>
              </div>
            </div>
            {/* Utilization bar */}
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallUtilization > 70 ? 'bg-red-500' :
                  overallUtilization > 30 ? 'bg-amber-400' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, overallUtilization)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Card list */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4">
        {cards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💳</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">No cards yet</h2>
            <p className="text-sm text-gray-400 mb-6">
              Add your credit cards to track balances, minimum payments, and plan your payoff strategy.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleAdd}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Add Your First Card
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Import from CSV
              </button>
            </div>
          </div>
        ) : (
          <CardList cards={cards} onEdit={handleEdit} />
        )}
      </main>

      {/* Card form modal */}
      <CardForm
        open={formOpen}
        editCard={editCard}
        onClose={() => {
          setFormOpen(false);
          setEditCard(null);
        }}
      />

      {/* CSV import modal */}
      <CSVImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}

export default function CardsPage() {
  return (
    <AppProviders>
      <CardsPageInner />
    </AppProviders>
  );
}
