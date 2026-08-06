// Core types for Cash Flow Calendar — Phase 1 MVP

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
