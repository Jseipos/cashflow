// Core types for Cash Flow Calendar — Phase 1 + Phase 2

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  currentBalance: number; // cents
  lowBalanceThreshold: number; // cents
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledItem {
  id: string;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // cents (positive for income, positive for expense — direction determined by type)
  description: string;
  categoryId?: string;

  // Recurrence
  recurrence: 'once' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceRule?: string;
  startDate: Date; // first occurrence
  endDate?: Date | null; // null = indefinite

  isActive: boolean;
  lastProcessedDate?: Date | null;

  // Phase 2: source tracking for auto-generated items
  sourceId?: string; // ID of the CreditCard or WishlistItem that generated this
  sourceType?: 'card' | 'payoff' | 'wishlist';

  createdAt: Date;
  updatedAt: Date;
}

// A generated instance of a scheduled item on a specific day
export interface ScheduledInstance {
  id: string; // unique per occurrence
  scheduledItemId: string;
  date: Date;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // cents
  description: string;
  accountId: string;
  sourceType?: 'card' | 'payoff' | 'wishlist';
}

// Running balance for a single day
export interface DayBalance {
  date: Date;
  balance: number; // cents — projected balance at end of day
  items: ScheduledInstance[];
  isLowBalance: boolean;
  isBelowZero: boolean;
}

export type RecurrenceType = 'once' | 'weekly' | 'biweekly' | 'monthly';
export type ItemType = 'income' | 'expense' | 'transfer';

// Phase 2: Credit Card
export interface CreditCard {
  id: string;
  name: string;
  balance: number; // cents
  apr: number; // percentage (e.g., 24.99)
  minimumPayment: number; // cents
  creditLimit: number; // cents
  statementDate: number; // day of month (1-31)
  dueDate: number; // day of month (1-31)
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Phase 2: Wishlist Item
export interface WishlistItem {
  id: string;
  name: string;
  estimatedCost: number; // cents
  priority: number; // 1 = highest
  monthlySavings: number; // cents — how much to save per month toward this
  targetDate?: Date | null; // optional target date
  savedSoFar: number; // cents
  isActive: boolean;
  isPurchased: boolean;
  savingsDay: number; // day of month for savings contribution (1-28, default 1)
  createdAt: Date;
  updatedAt: Date;
}

// Phase 2: Payoff calculation result types
export interface PayoffResultCard {
  cardId: string;
  cardName: string;
  startingBalance: number; // cents
  payoffMonth: number; // months from start
  payoffDate: Date;
  totalInterestPaid: number; // cents
  payments: AmortizationPayment[];
}

export interface AmortizationPayment {
  month: number;
  date: Date;
  payment: number; // cents (total payment for this card this month)
  interest: number; // cents
  principal: number; // cents
  balanceAfter: number; // cents
}

export interface PayoffPlanResult {
  strategy: 'avalanche' | 'snowball';
  extraPayment: number; // cents per month
  cards: PayoffResultCard[];
  totalInterest: number; // cents
  totalPaid: number; // cents
  debtFreeDate: Date;
  totalMonths: number;
}
