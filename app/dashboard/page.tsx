'use client';

import { useMemo } from 'react';
import { AppProviders, useCashflow, useCategories, useCards, useWishlist } from '@/lib/context';
import { InsightCard } from './InsightCard';
import {
  spendingOverview,
  cashFlowHealth,
  debtAndSavings,
  smartNudges,
  type InsightSection,
} from './insights';

function DashboardPageInner() {
  const { accounts, selectedAccount, scheduledItems, loading, error } = useCashflow();
  const { categories } = useCategories();
  const { cards } = useCards();
  const { items: wishlist } = useWishlist();

  const sections: InsightSection[] = useMemo(() => {
    return [
      spendingOverview(scheduledItems, categories),
      cashFlowHealth(selectedAccount, scheduledItems),
      debtAndSavings(cards, wishlist),
      smartNudges(scheduledItems, categories, cards, selectedAccount),
    ];
  }, [scheduledItems, categories, selectedAccount, cards, wishlist]);

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              📊
            </div>
            <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          </div>
          {selectedAccount && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Account</div>
              <div className="text-sm font-semibold text-gray-700">{selectedAccount.name}</div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 px-1">
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </section>
        ))}

        {/* Empty state */}
        {scheduledItems.length === 0 && accounts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-gray-500">
              Add accounts and scheduled items to see your financial insights here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppProviders>
      <DashboardPageInner />
    </AppProviders>
  );
}
