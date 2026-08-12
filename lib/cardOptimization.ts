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
