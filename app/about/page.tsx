'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              ₿
            </div>
            <h1 className="text-lg font-bold text-gray-900">About Cashflow</h1>
          </div>
          <span className="text-xs text-gray-400 font-medium">v1.0</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-8">
        {/* Tagline */}
        <div className="text-center py-4">
          <p className="text-base text-gray-600 leading-relaxed max-w-md mx-auto">
            A forward-looking personal finance app that shows you exactly where your money is going — before it gets there.
          </p>
        </div>

        {/* Calendar */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📅</span>
            <h2 className="text-base font-bold text-gray-900">Cash Flow Calendar</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>Visual month-view calendar with projected daily balances</li>
            <li>Color-coded days: green (healthy), yellow (low balance), red (negative)</li>
            <li>Tap any day for scheduled income, expenses, and running balance</li>
            <li>Recurring items: weekly, biweekly, monthly, or one-time</li>
            <li>Category breakdown sidebar with monthly spending by category</li>
            <li>Multiple account support (checking, savings, cash, credit)</li>
            <li>Low-balance threshold alerts per account</li>
            <li>Transfer support between accounts</li>
          </ul>
        </section>

        {/* Dashboard */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📊</span>
            <h2 className="text-base font-bold text-gray-900">Financial Dashboard</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li><strong>Spending Overview</strong> — top category, month-over-month change, daily average</li>
            <li><strong>Cash Flow Health</strong> — total balance, projected lowest balance per account, bills due this week, income vs. expenses</li>
            <li><strong>Debt & Savings</strong> — total credit card debt, highest APR card, wishlist progress</li>
            <li><strong>Smart Nudges</strong> — alerts for dining overspend, subscription creep, surplus cash, high APR warnings, and balance thresholds</li>
          </ul>
        </section>

        {/* Cards */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💳</span>
            <h2 className="text-base font-bold text-gray-900">Credit Card Manager</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>Track all cards with balance, APR, credit limit, minimum payment, and due dates</li>
            <li>Live balance calculation from logged transactions</li>
            <li>Projected balance including accrued interest and scheduled payments</li>
            <li>CSV import for bulk transaction history</li>
            <li>Log expenses and payments directly against cards</li>
            <li>Overall utilization tracking and interest accrued visibility</li>
          </ul>
        </section>

        {/* Payoff */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <h2 className="text-base font-bold text-gray-900">Debt Payoff Calculator</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li><strong>Avalanche</strong> — highest APR first (saves the most interest)</li>
            <li><strong>Snowball</strong> — lowest balance first (psychological wins)</li>
            <li>Side-by-side strategy comparison with interest savings</li>
            <li>Extra monthly payment slider ($0–$5,000)</li>
            <li>Per-card payoff order with dates, interest paid, and months to clear</li>
            <li>Debt-free date projection</li>
            <li>One-tap "Apply to Calendar" — replaces minimum payments with optimized payoff payments</li>
            <li>Custom plan start date</li>
          </ul>
        </section>

        {/* Wishlist */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⭐</span>
            <h2 className="text-base font-bold text-gray-900">Savings Wishlist</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>Track items you're saving toward with estimated cost and priority</li>
            <li>Monthly savings contribution per item</li>
            <li>Progress bars and percentage tracking</li>
            <li>Auto-generates savings line items on your calendar</li>
            <li>Mark items as purchased when you reach your goal</li>
          </ul>
        </section>

        {/* Receipt Scanner */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📷</span>
            <h2 className="text-base font-bold text-gray-900">Receipt Scanner</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>Camera-based receipt capture</li>
            <li>Manual entry confirmation (amount, merchant, date, category)</li>
            <li>Route expenses to bank account or credit card</li>
            <li>Log card payments from the same flow</li>
          </ul>
        </section>

        {/* Categories */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🏷️</span>
            <h2 className="text-base font-bold text-gray-900">Categories</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>Custom spending categories with emoji icons and colors</li>
            <li>Pre-built defaults for common expenses</li>
            <li>Category picker integrated into all expense flows</li>
          </ul>
        </section>

        {/* Data Management */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💾</span>
            <h2 className="text-base font-bold text-gray-900">Data Management</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>Full JSON backup and restore (all 6 data tables)</li>
            <li>CSV export of scheduled items</li>
            <li>Import template for bulk setup</li>
          </ul>
        </section>

        {/* Privacy */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔒</span>
            <h2 className="text-base font-bold">Privacy & Architecture</h2>
          </div>
          <ul className="space-y-1.5 text-sm opacity-90">
            <li><strong>100% local-first</strong> — your financial data never leaves your device</li>
            <li><strong>No account required</strong> — no sign-up, no email, no password</li>
            <li><strong>No server</strong> — runs entirely in your browser using IndexedDB</li>
            <li><strong>PWA-ready</strong> — add to your phone's home screen for a native app experience</li>
            <li><strong>Offline capable</strong> — works without an internet connection</li>
          </ul>
        </section>

        {/* Tech stack */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Next.js · React · TypeScript · Tailwind CSS · Dexie (IndexedDB) · date-fns · Vercel
          </p>
        </div>
      </main>
    </div>
  );
}
