import {
  addDays,
  startOfDay,
  isBefore,
  addWeeks,
  addMonths,
} from 'date-fns';
import type {
  Account,
  ScheduledItem,
  ScheduledInstance,
  DayBalance,
} from './types';

/**
 * Generate all occurrences of a scheduled item within a date range.
 */
export function expandScheduledItem(
  item: ScheduledItem,
  rangeStart: Date,
  rangeEnd: Date,
): ScheduledInstance[] {
  const instances: ScheduledInstance[] = [];
  const start = startOfDay(item.startDate);
  const end = item.endDate ? startOfDay(item.endDate) : null;
  const rangeS = startOfDay(rangeStart);
  const rangeE = startOfDay(rangeEnd);

  if (isBefore(end ?? rangeE, rangeS)) return instances; // ended before range
  if (isBefore(rangeE, start)) return instances; // starts after range

  let current = start;
  let safetyCounter = 0;
  const MAX_ITERATIONS = 10000;

  while (safetyCounter < MAX_ITERATIONS) {
    // Past the end date
    if (end && isBefore(end, current)) break;
    // Past the range end
    if (isBefore(rangeE, current)) break;

    // If current is within the range
    if (!isBefore(current, rangeS)) {
      instances.push({
        id: `${item.id}-${current.toISOString()}`,
        scheduledItemId: item.id,
        date: current,
        type: item.type,
        amount: item.amount,
        description: item.description,
        accountId: item.accountId,
        categoryId: item.categoryId,
        sourceType: item.sourceType,
        toAccountId: item.toAccountId,
      });
    }

    // Advance based on recurrence
    switch (item.recurrence) {
      case 'once':
        return instances; // only one occurrence
      case 'weekly':
        current = addWeeks(current, 1);
        break;
      case 'biweekly':
        current = addWeeks(current, 2);
        break;
      case 'monthly':
        current = addMonths(current, 1);
        break;
      default:
        return instances;
    }
    safetyCounter++;
  }

  return instances;
}

/**
 * Calculate running balance projection for a range of days.
 * Returns an array of DayBalance objects for the specified account.
 * Transfers OUT of this account are treated as expenses, transfers IN are income.
 */
export function projectBalances(
  account: Account,
  scheduledItems: ScheduledItem[],
  startDate: Date,
  days: number = 90,
): DayBalance[] {
  const start = startOfDay(startDate);
  const end = addDays(start, days - 1);

  // Expand all scheduled items into instances within the range
  const allInstances: ScheduledInstance[] = [];
  for (const item of scheduledItems) {
    if (!item.isActive) continue;

    if (item.type === 'transfer') {
      // Transfer affects both the source and destination account
      if (item.accountId === account.id) {
        // This account is the source — money goes out
        allInstances.push(...expandScheduledItem(item, start, end));
      } else if (item.toAccountId === account.id) {
        // This account is the destination — money comes in
        // Create a mirrored instance as income
        const transferInstances = expandScheduledItem(item, start, end);
        for (const inst of transferInstances) {
          allInstances.push({
            ...inst,
            id: `${inst.id}-inbound`,
            type: 'income' as const,
            accountId: account.id,
            description: inst.description.includes('→') ? inst.description : `${inst.description} (transfer in)`,
          });
        }
      }
    } else {
      // Regular income/expense — only include if it belongs to this account
      if (item.accountId === account.id) {
        allInstances.push(...expandScheduledItem(item, start, end));
      }
    }
  }

  // Group instances by day (ISO date string)
  const byDay = new Map<string, ScheduledInstance[]>();
  for (const inst of allInstances) {
    const key = inst.date.toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(inst);
  }

  // Walk day by day, computing running balance.
  // currentBalance is treated as the balance at the BEGINNING of the projection
  // start date. All transactions within the range are applied, including those
  // on the start date itself. This ensures that if a user sets a starting balance
  // on a day that also has expenses, the displayed balance for that day reflects
  // the expenses being subtracted.
  const result: DayBalance[] = [];
  let runningBalance = account.currentBalance;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const key = date.toDateString();
    const dayItems = byDay.get(key) ?? [];

    // Apply each item to the running balance
    for (const item of dayItems) {
      if (item.type === 'income') {
        runningBalance += item.amount;
      } else if (item.type === 'expense') {
        runningBalance -= item.amount;
      } else if (item.type === 'transfer') {
        // Transfer out from this account
        runningBalance -= item.amount;
      }
    }

    const isLowBalance = runningBalance < account.lowBalanceThreshold;
    const isBelowZero = runningBalance < 0;

    result.push({
      date,
      balance: runningBalance,
      items: dayItems.sort((a, b) => {
        // income first, then expense
        if (a.type === 'income' && b.type !== 'income') return -1;
        if (a.type !== 'income' && b.type === 'income') return 1;
        return a.description.localeCompare(b.description);
      }),
      isLowBalance,
      isBelowZero,
    });
  }

  return result;
}

/**
 * Format cents as a dollar string.
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '';
  const abs = Math.abs(dollars);
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format cents as a compact string for calendar cells (e.g. "$1.2k")
 */
export function formatCurrencyCompact(cents: number): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? '-' : '';

  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}
