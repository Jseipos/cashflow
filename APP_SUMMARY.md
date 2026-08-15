# Cashflow

**A forward-looking personal finance app that shows you exactly where your money is going — before it gets there.**

---

## What It Does

Cashflow replaces the spreadsheet-and-guesswork approach to budgeting with a visual, calendar-based projection of your actual cash flow. Instead of tracking what you already spent, it shows what your balance will look like tomorrow, next week, and next month based on your real income, bills, and spending patterns.

---

## Core Features

### 📅 Cash Flow Calendar
- Visual month-view calendar showing projected daily balances
- Color-coded days: green (healthy), yellow (low balance warning), red (negative)
- Tap any day to see scheduled income, expenses, and running balance
- Recurring items: weekly, biweekly, monthly, or one-time
- Category breakdown sidebar showing monthly spending by category
- Multiple account support (checking, savings, cash, credit)
- Low-balance threshold alerts per account
- Transfer support between accounts

### 📊 Financial Dashboard
- **Spending Overview** — top category, month-over-month change, daily average spend
- **Cash Flow Health** — total balance, projected lowest balance per account (next 30 days), bills due this week, income vs. expenses
- **Debt & Savings** — total credit card debt, highest APR card, wishlist savings progress
- **Smart Nudges** — actionable alerts for dining overspend, subscription creep, surplus cash opportunities, high APR warnings, and balance threshold proximity

### 💳 Credit Card Manager
- Track all cards with balance, APR, credit limit, minimum payment, statement/due dates
- Live balance calculation from logged transactions
- Projected balance including scheduled payments
- CSV import for bulk transaction history
- Log expenses and payments directly against cards
- Overall utilization tracking
- Total interest accrued visibility

### 🎯 Debt Payoff Calculator
- **Avalanche strategy** — highest APR first (saves the most interest)
- **Snowball strategy** — lowest balance first (psychological wins)
- Side-by-side strategy comparison with interest savings
- Extra monthly payment slider ($0–$5,000)
- Per-card payoff order with dates, interest paid, and months to clear
- Debt-free date projection
- **One-tap "Apply to Calendar"** — replaces minimum payments with optimized payoff payments on your calendar
- Custom plan start date (e.g., delay to save for a house first)
- Disable plan to restore minimum payments

### ⭐ Savings Wishlist
- Track items you're saving toward with estimated cost and priority
- Monthly savings contribution per item
- Progress bars and percentage tracking
- Auto-generates savings line items on your calendar
- Mark items as purchased when you reach your goal

### 📷 Receipt Scanner
- Camera-based receipt capture
- Manual entry confirmation (amount, merchant, date, category)
- Route expenses to bank account or credit card
- Log card payments from the same flow

### 🏷️ Categories
- Custom spending categories with emoji icons and colors
- Pre-built defaults for common expenses
- Category picker integrated into all expense flows

### 💾 Data Management
- Full JSON backup and restore (all 6 data tables)
- CSV export of scheduled items
- Import template for bulk setup
- All data stored locally in your browser (IndexedDB) — no server, no account, no tracking

---

## Privacy & Architecture

- **100% local-first** — your financial data never leaves your device
- **No account required** — no sign-up, no email, no password
- **No server** — runs entirely in your browser using IndexedDB
- **PWA-ready** — add to your phone's home screen for a native app experience
- **Offline capable** — works without an internet connection

---

## Tech Stack

Next.js · React · TypeScript · Tailwind CSS · Dexie (IndexedDB) · date-fns · Deployed on Vercel
