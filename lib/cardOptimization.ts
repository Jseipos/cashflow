import type { CreditCard, CardTransaction } from './types';

export interface PaymentRecommendation {
  cardId: string;
  recommendedPayment: number; // cents
  recommendedDate: Date;
  reason: string;
  interestSaved: number; // cents
  daysUntilDue: number;
}

/**
 * Get the next occurrence of a day-of-month from the reference date.
 */
function nextDayOfMonth(day: number, fromDate: Date): Date {
  const result = new Date(fromDate.getFullYear(), fromDate.getMonth(), day);
  if (result < fromDate) {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

/**
 * Calculate daily interest accrual for a card balance.
 * APR is converted to daily periodic rate: APR / 365 / 100
 */
function dailyInterest(balance: number, apr: number): number {
  return balance * (apr / 100 / 365);
}

/**
 * Calculate the optimal payment for a credit card to minimize interest
 * and optimize credit utilization.
 *
 * Strategy:
 * 1. If statement date is coming up and balance > 0, recommend paying
 *    before statement date to reduce reported utilization.
 * 2. If due date is coming up, recommend paying at least minimum to avoid late fees.
 * 3. If APR > 0 and balance > 0, calculate interest accrual and recommend
 *    paying as much as possible before the due date.
 * 4. The "optimal date" is typically before the statement date (for utilization)
 *    or before the due date (for interest avoidance).
 */
export function calculateOptimalPayment(
  card: CreditCard,
  transactions: CardTransaction[],
  currentDate: Date,
): PaymentRecommendation | null {
  if (!card.isActive || card.balance <= 0) return null;

  const now = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  // Calculate live balance from transactions (fallback to card.balance)
  const liveBalance = transactions.length > 0
    ? transactions.reduce((bal, tx) => {
        if (tx.type === 'expense') return bal + tx.amount;
        if (tx.type === 'payment') return bal - tx.amount;
        return bal;
      }, 0)
    : card.balance;

  if (liveBalance <= 0) return null;

  const nextStatementDate = nextDayOfMonth(card.statementDate, now);
  const nextDueDate = nextDayOfMonth(card.dueDate, now);

  const daysUntilStatement = Math.ceil(
    (nextStatementDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysUntilDue = Math.ceil(
    (nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Calculate interest that will accrue between now and due date
  const interestAccruedUntilDue = Math.round(
    dailyInterest(liveBalance, card.apr) * daysUntilDue,
  );

  // Calculate interest that will accrue between now and statement date
  const interestAccruedUntilStatement = Math.round(
    dailyInterest(liveBalance, card.apr) * daysUntilStatement,
  );

  // Determine the best strategy
  let recommendedPayment: number;
  let recommendedDate: Date;
  let reason: string;
  let interestSaved: number;

  if (daysUntilStatement >= 0 && daysUntilStatement <= daysUntilDue) {
    // Statement date comes first (or is today) — pay before statement to reduce utilization
    recommendedDate = nextStatementDate;

    // Pay as much as possible — ideally the full balance
    // But at minimum, pay enough to reduce utilization below 30%
    const targetUtilizationBalance = Math.round(card.creditLimit * 0.30);
    const amountToReach30Pct = Math.max(0, liveBalance - targetUtilizationBalance);

    if (liveBalance <= card.creditLimit * 0.30) {
      // Already under 30% utilization — still recommend paying to save interest
      recommendedPayment = Math.max(card.minimumPayment, Math.min(liveBalance, liveBalance));
      reason = `Pay before statement closes on the ${ordinal(card.statementDate)} to keep utilization low and save interest.`;
    } else {
      // Above 30% — recommend paying enough to get under 30%
      recommendedPayment = Math.max(amountToReach30Pct, card.minimumPayment);
      reason = `Pay before statement closes on the ${ordinal(card.statementDate)} to bring utilization under 30%.`;
    }

    // Interest saved by paying before statement date
    interestSaved = interestAccruedUntilStatement;
  } else if (daysUntilDue >= 0) {
    // Due date is next — pay at least minimum to avoid late fee
    recommendedDate = nextDueDate;

    if (card.apr > 0) {
      // With APR, recommend paying full balance if possible to avoid all interest
      recommendedPayment = liveBalance;
      reason = `Pay full balance before due date on the ${ordinal(card.dueDate)} to avoid ${formatCents(interestAccruedUntilDue)} in interest charges.`;
      interestSaved = interestAccruedUntilDue;
    } else {
      // No APR — just pay minimum
      recommendedPayment = card.minimumPayment;
      reason = `Pay at least the minimum by due date on the ${ordinal(card.dueDate)} to avoid late fees.`;
      interestSaved = 0;
    }
  } else {
    // Both dates have passed this cycle — recommend paying ASAP
    recommendedDate = now;
    recommendedPayment = Math.max(card.minimumPayment, liveBalance);
    reason = `Payment is past due. Pay as soon as possible to avoid additional interest and fees.`;
    interestSaved = interestAccruedUntilDue;
  }

  // Cap recommended payment at the balance
  recommendedPayment = Math.min(recommendedPayment, liveBalance);

  // Ensure at least minimum payment
  if (recommendedPayment < card.minimumPayment && liveBalance > 0) {
    recommendedPayment = Math.min(card.minimumPayment, liveBalance);
  }

  return {
    cardId: card.id,
    recommendedPayment,
    recommendedDate,
    reason,
    interestSaved,
    daysUntilDue: Math.max(0, daysUntilDue),
  };
}

/**
 * Calculate live balance from transactions.
 */
export function getLiveBalance(transactions: CardTransaction[]): number {
  return transactions.reduce((balance, tx) => {
    if (tx.type === 'expense') return balance + tx.amount;
    if (tx.type === 'payment') return balance - tx.amount;
    return balance;
  }, 0);
}

/**
 * Calculate projected balance for a card, factoring in:
 * 1. Current live balance (from transactions)
 * 2. Accrued interest since the last transaction (daily compounding)
 * 3. Pending expenses from ScheduledItems linked to this card
 * 4. Scheduled payments that will reduce the balance
 *
 * This gives a realistic "what you actually owe" number without bank sync.
 */
export function getProjectedBalance(
  card: CreditCard,
  transactions: CardTransaction[],
  scheduledItems: import('./types').ScheduledItem[],
  asOfDate: Date = new Date(),
): {
  projectedBalance: number; // cents
  liveBalance: number; // cents
  accruedInterest: number; // cents
  pendingExpenses: number; // cents
  scheduledPayments: number; // cents
  daysAccrued: number;
} {
  const liveBalance = transactions.length > 0 ? getLiveBalance(transactions) : card.balance;

  // Find the most recent transaction date to calculate interest accrual
  const lastTxDate = transactions.length > 0
    ? new Date(Math.max(...transactions.map((tx) => new Date(tx.date).getTime())))
    : new Date(card.updatedAt);

  // Calculate days of interest accrual
  const daysAccrued = Math.max(
    0,
    Math.floor((asOfDate.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  // Accrued interest: daily compounding on the live balance
  // dailyRate = APR / 365 / 100
  // accrued = balance × ((1 + dailyRate)^days - 1)
  const dailyRate = card.apr / 100 / 365;
  const accruedInterest = liveBalance > 0 && card.apr > 0
    ? Math.round(liveBalance * (Math.pow(1 + dailyRate, daysAccrued) - 1))
    : 0;

  // Find pending expenses from ScheduledItems linked to this card
  // These are expenses that are scheduled but haven't been recorded as CardTransactions yet
  const cardScheduledItems = scheduledItems.filter(
    (item) => item.sourceId === card.id && item.sourceType === 'card' && item.isActive,
  );

  let pendingExpenses = 0;
  let scheduledPayments = 0;

  for (const item of cardScheduledItems) {
    const isPayment = item.description.toLowerCase().includes('payment');
    
    if (item.type === 'expense' && !isPayment) {
      // Regular expense: adds to the card balance
      if (item.recurrence === 'once') {
        if (new Date(item.startDate) > asOfDate) {
          pendingExpenses += item.amount;
        }
      } else {
        const nextStatement = nextDayOfMonth(card.statementDate, asOfDate);
        const occurrences = countOccurrences(item, asOfDate, nextStatement);
        pendingExpenses += item.amount * occurrences;
      }
    } else if (item.type === 'expense' && isPayment) {
      // Scheduled payment: reduces the card balance
      if (item.recurrence === 'once') {
        if (new Date(item.startDate) > asOfDate) {
          scheduledPayments += item.amount;
        }
      } else {
        const nextDue = nextDayOfMonth(card.dueDate, asOfDate);
        const occurrences = countOccurrences(item, asOfDate, nextDue);
        scheduledPayments += item.amount * occurrences;
      }
    }
  }

  const projectedBalance = Math.max(0, liveBalance + accruedInterest + pendingExpenses - scheduledPayments);

  return {
    projectedBalance,
    liveBalance,
    accruedInterest,
    pendingExpenses,
    scheduledPayments,
    daysAccrued,
  };
}

/**
 * Count how many times a recurring scheduled item occurs between two dates.
 */
function countOccurrences(
  item: import('./types').ScheduledItem,
  from: Date,
  to: Date,
): number {
  if (item.recurrence === 'once') {
    const itemDate = new Date(item.startDate);
    return itemDate >= from && itemDate <= to ? 1 : 0;
  }

  let count = 0;
  let current = new Date(item.startDate);
  const end = item.endDate ? new Date(item.endDate) : null;

  // Fast-forward to first occurrence >= from
  while (current < from) {
    switch (item.recurrence) {
      case 'weekly':
        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'biweekly':
        current = new Date(current.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
        break;
      default:
        return 0;
    }
    if (end && current > end) return 0;
  }

  // Count occurrences between from and to
  while (current <= to) {
    if (end && current > end) break;
    count++;
    switch (item.recurrence) {
      case 'weekly':
        current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'biweekly':
        current = new Date(current.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
        break;
      default:
        return count;
    }
  }

  return count;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
