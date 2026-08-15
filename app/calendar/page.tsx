'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  format,
  addMonths,
  subMonths,
  isToday,
  isSameDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from 'date-fns';
import { CashflowProvider, CategoryProvider, CardProvider, useCashflow, useCategories } from '@/lib/context';
import { CalendarGrid } from './CalendarGrid';
import { DayDetailPanel } from './DayDetailPanel';
import { AddScheduledItemModal } from './AddScheduledItemModal';
import { SettingsModal } from './SettingsModal';
import { projectBalances, formatCurrency } from '@/lib/calculations';
import type { DayBalance, ScheduledItem } from '@/lib/types';

function CalendarPageInner() {
  const { accounts, selectedAccountId, selectedAccount, scheduledItems, loading, error, setSelectedAccountId } = useCashflow();
  const { categories } = useCategories();

  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [editItem, setEditItem] = useState<ScheduledItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);


  // Get the balance map for the full projection (for today's balance display)
  // Project from 90 days ago so past transactions are reflected in today's balance.
  // currentBalance is treated as the starting balance at the beginning of the projection.
  const todayBalance = useMemo(() => {
    if (!selectedAccount) return null;
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 90);
    const balances = projectBalances(selectedAccount, scheduledItems, lookback, 91);
    const today = new Date();
    return balances.find((b) => isSameDay(b.date, today)) ?? null;
  }, [selectedAccount, scheduledItems]);

  // Get the DayBalance for the selected date — use the same projection window as the grid
  const selectedDayBalance = useMemo(() => {
    if (!selectedDate || !selectedAccount) return null;
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const today = new Date();
    const projStart = isBeforeDay(monthStart, startOfDay(today)) ? monthStart : startOfDay(today);
    const projDays = Math.max(
      90,
      differenceInDaysSafe(monthEnd, projStart) + 1,
    );
    const balances = projectBalances(selectedAccount, scheduledItems, projStart, projDays);
    return balances.find((b) => isSameDay(b.date, selectedDate)) ?? null;
  }, [selectedDate, selectedAccount, scheduledItems, viewMonth]);

  // Spending by category for current month
  const monthCategorySummary = useMemo(() => {
    if (!selectedAccount) return [];
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const today = new Date();
    const projStart = isBeforeDay(monthStart, startOfDay(today)) ? monthStart : startOfDay(today);
    const projDays = Math.max(
      90,
      differenceInDaysSafe(monthEnd, projStart) + 1,
    );
    const balances = projectBalances(selectedAccount, scheduledItems, projStart, projDays);

    // Collect all expense instances within the month
    const catTotals = new Map<string, number>(); // categoryId -> cents
    for (const day of balances) {
      if (!isWithinInterval(day.date, { start: monthStart, end: monthEnd })) continue;
      for (const item of day.items) {
        if (item.type !== 'expense') continue;
        if (item.categoryId) {
          catTotals.set(item.categoryId, (catTotals.get(item.categoryId) ?? 0) + item.amount);
        } else {
          // Uncategorized
          catTotals.set('__none', (catTotals.get('__none') ?? 0) + item.amount);
        }
      }
    }

    // Build summary sorted by amount descending
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const summary = Array.from(catTotals.entries())
      .map(([catId, total]) => {
        const cat = catId !== '__none' ? catMap.get(catId) : null;
        return {
          id: catId,
          name: cat?.name ?? 'Uncategorized',
          icon: cat?.icon ?? '📦',
          color: cat?.color ?? '#94a3b8',
          total,
        };
      })
      .sort((a, b) => b.total - a.total);

    return summary;
  }, [selectedAccount, scheduledItems, viewMonth, categories]);

  const totalMonthSpending = monthCategorySummary.reduce((sum, c) => sum + c.total, 0);

  const handleSelectDay = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedDate(null);
  }, []);

  const handleAddItem = useCallback((date: Date) => {
    setEditItem(null);
    setModalDate(date);
    setModalOpen(true);
    setSelectedDate(null);
  }, []);

  const handleEditItem = useCallback((item: ScheduledItem) => {
    const full = scheduledItems.find((s) => s.id === item.id);
    setEditItem(full ?? item);
    setModalDate(null);
    setModalOpen(true);
    setSelectedDate(null);
  }, [scheduledItems]);

  const handleAddButton = useCallback(() => {
    setEditItem(null);
    setModalDate(selectedDate ?? new Date());
    setModalOpen(true);
  }, [selectedDate]);

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
              ₿
            </div>
            <h1 className="text-lg font-bold text-gray-900">Cash Flow</h1>
          </div>
          <div className="flex items-center gap-2">
            {todayBalance && (
              <div className="hidden sm:block text-right">
                <div className="text-xs text-gray-400">Today</div>
                <div className={`text-sm font-bold ${
                  todayBalance.isBelowZero ? 'text-red-600'
                    : todayBalance.isLowBalance ? 'text-amber-600'
                    : 'text-green-700'
                }`}>
                  {formatCurrency(todayBalance.balance)}
                </div>
              </div>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Account switcher */}
      {accounts.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {accounts.map((acct) => {
              const isSelected = acct.id === selectedAccountId;
              return (
                <button
                  key={acct.id}
                  onClick={() => setSelectedAccountId(acct.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    isSelected
                      ? 'text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                  style={isSelected ? { backgroundColor: acct.color } : undefined}
                >
                  <span className="text-xs">
                    {acct.type === 'checking' ? '🏦' : acct.type === 'savings' ? '🐷' : acct.type === 'cash' ? '💵' : '💳'}
                  </span>
                  <span>{acct.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Month navigation */}
      <div className="max-w-2xl mx-auto w-full px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
          aria-label="Previous month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          {format(viewMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
          aria-label="Next month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="max-w-2xl mx-auto w-full px-4 pb-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Income
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Expense
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Transfer
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-amber-400" />
          Low
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-red-500" />
          Overdraft
        </div>
      </div>

      {/* Calendar grid */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24">
        {selectedAccount && (
          <CalendarGrid
            account={selectedAccount}
            scheduledItems={scheduledItems}
            viewMonth={viewMonth}
            selectedDate={selectedDate}
            onSelectDay={handleSelectDay}
          />
        )}

        {/* Spending by category summary */}
        {monthCategorySummary.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">
                {format(viewMonth, 'MMM')} Spending
              </h3>
              <span className="text-sm font-semibold text-gray-700">
                {formatCurrency(totalMonthSpending)}
              </span>
            </div>
            <div className="space-y-2">
              {monthCategorySummary.slice(0, 6).map((cat) => {
                const pct = totalMonthSpending > 0 ? (cat.total / totalMonthSpending) * 100 : 0;
                return (
                  <div key={cat.id} className="flex items-center gap-2">
                    <span className="text-base leading-none w-5">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700 truncate">{cat.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {monthCategorySummary.length > 6 && (
                <p className="text-xs text-gray-400 pt-1">
                  +{monthCategorySummary.length - 6} more categories
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating add button */}
      <button
        onClick={handleAddButton}
        className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-30"
        aria-label="Add scheduled item"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

{/* Day detail panel */}
      {selectedDayBalance && (
        <DayDetailPanel
          dayBalance={selectedDayBalance}
          onClose={handleClosePanel}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
        />
      )}

      {/* Add/Edit modal */}
      <AddScheduledItemModal
        open={modalOpen}
        initialDate={modalDate}
        editItem={editItem}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
      />

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

// Helper functions
function isBeforeDay(a: Date, b: Date): boolean {
  const aTime = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bTime = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return aTime < bTime;
}

function differenceInDaysSafe(a: Date, b: Date): number {
  const aTime = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bTime = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aTime - bTime) / (1000 * 60 * 60 * 24));
}

export default function CalendarPage() {
  return (
    <CashflowProvider>
      <CategoryProvider>
        <CardProvider>
          <CalendarPageInner />
        </CardProvider>
      </CategoryProvider>
    </CashflowProvider>
  );
}
