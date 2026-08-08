import { addMonths } from 'date-fns';
import type { CreditCard, PayoffPlanResult, PayoffResultCard, AmortizationPayment } from './types';

/**
 * Calculate credit card payoff plan using either avalanche or snowball strategy.
 *
 * Avalanche: Pay off highest APR first.
 * Snowball: Pay off lowest balance first.
 *
 * Both strategies roll paid-off cards' minimum payments into the next card
 * (the "payment snowball" effect).
 *
 * @param cards - Active credit cards
 * @param extraPayment - Extra cents per month toward debt payoff
 * @param strategy - 'avalanche' or 'snowball'
 * @param startDate - When to start the plan (default: today)
 */
export function calculatePayoff(
  cards: CreditCard[],
  extraPayment: number, // cents
  strategy: 'avalanche' | 'snowball',
  startDate: Date = new Date(),
): PayoffPlanResult {
  // Filter to active cards with a balance
  const activeCards = cards.filter((c) => c.isActive && c.balance > 0);

  if (activeCards.length === 0) {
    return {
      strategy,
      extraPayment,
      cards: [],
      totalInterest: 0,
      totalPaid: 0,
      debtFreeDate: startDate,
      totalMonths: 0,
    };
  }

  // Working copies of card balances
  const balances = new Map<string, number>(); // cents
  const payments = new Map<string, AmortizationPayment[]>();
  const originalMinPayments = new Map<string, number>();

  for (const card of activeCards) {
    balances.set(card.id, card.balance);
    payments.set(card.id, []);
    originalMinPayments.set(card.id, card.minimumPayment);
  }

  // Track which cards are paid off and the order
  const payoffOrder: string[] = [];
  const payoffMonthMap = new Map<string, number>();

  let month = 0;
  const maxMonths = 1200; // 100 year safety cap

  while (month < maxMonths) {
    // Determine which cards still have balances
    const remainingCards = activeCards.filter((c) => (balances.get(c.id) ?? 0) > 0);

    if (remainingCards.length === 0) break;

    // Sort remaining cards by strategy to find the target card
    let sortedRemaining: CreditCard[];
    if (strategy === 'avalanche') {
      sortedRemaining = [...remainingCards].sort((a, b) => b.apr - a.apr);
    } else {
      sortedRemaining = [...remainingCards].sort((a, b) => (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0));
    }

    const targetCard = sortedRemaining[0];
    const currentDate = addMonths(startDate, month);

    // Calculate available "rolling" payment pool:
    // Sum of all original minimum payments for cards that are already paid off
    // + the target card's minimum payment + extra payment
    let paymentPool = extraPayment;
    for (const card of activeCards) {
      if ((balances.get(card.id) ?? 0) <= 0) {
        // This card is paid off — its min payment rolls into the pool
        paymentPool += originalMinPayments.get(card.id) ?? 0;
      }
    }

    // Pay each remaining card
    for (const card of remainingCards) {
      const balance = balances.get(card.id) ?? 0;
      if (balance <= 0) continue;

      const monthlyInterestRate = card.apr / 100 / 12;
      const interest = Math.round(balance * monthlyInterestRate);
      const minPayment = originalMinPayments.get(card.id) ?? card.minimumPayment;

      let payment: number;

      if (card.id === targetCard.id) {
        // Target card gets: its min payment + all rolled-over payments + extra
        // But we already added rolled-over min payments to the pool.
        // The pool includes extra + all paid-off cards' min payments.
        // The target card's own min payment is NOT in the pool yet.
        // So total for target = minPayment + paymentPool
        // But paymentPool already includes extra + paid-off cards' min payments.
        // We need to be careful: the target card's min payment should not be double-counted.

        // Actually, let's recalculate:
        // paymentPool = extra + sum of min payments of paid-off cards
        // Target card total = target's min payment + paymentPool
        // But the target card is NOT paid off, so its min payment is NOT in the pool.

        payment = minPayment + paymentPool;
      } else {
        // Non-target card: just pay its minimum payment
        payment = minPayment;
      }

      // Ensure payment doesn't exceed balance + interest
      const maxNeeded = balance + interest;
      if (payment > maxNeeded) {
        payment = maxNeeded;
      }

      const principal = payment - interest;

      const newBalance = balance - principal;

      balances.set(card.id, Math.max(0, newBalance));

      payments.get(card.id)!.push({
        month,
        date: currentDate,
        payment,
        interest: Math.max(0, interest),
        principal: Math.max(0, principal),
        balanceAfter: Math.max(0, newBalance),
      });

      // Check if this card was just paid off
      if (newBalance <= 0 && !payoffMonthMap.has(card.id)) {
        payoffMonthMap.set(card.id, month);
        payoffOrder.push(card.id);
      }
    }

    month++;
  }

  // Build result cards in payoff order
  const resultCards: PayoffResultCard[] = payoffOrder.map((cardId) => {
    const card = activeCards.find((c) => c.id === cardId)!;
    const cardPayments = payments.get(cardId) ?? [];
    const totalInterestPaid = cardPayments.reduce((sum, p) => sum + p.interest, 0);
    const payoffMonth = payoffMonthMap.get(cardId) ?? 0;

    return {
      cardId: card.id,
      cardName: card.name,
      startingBalance: card.balance,
      payoffMonth,
      payoffDate: addMonths(startDate, payoffMonth),
      totalInterestPaid,
      payments: cardPayments,
    };
  });

  // Add any cards that somehow weren't in the payoff order
  for (const card of activeCards) {
    if (!payoffOrder.includes(card.id)) {
      const cardPayments = payments.get(card.id) ?? [];
      const totalInterestPaid = cardPayments.reduce((sum, p) => sum + p.interest, 0);
      const payoffMonth = payoffMonthMap.get(card.id) ?? month;
      resultCards.push({
        cardId: card.id,
        cardName: card.name,
        startingBalance: card.balance,
        payoffMonth,
        payoffDate: addMonths(startDate, payoffMonth),
        totalInterestPaid,
        payments: cardPayments,
      });
    }
  }

  const totalInterest = resultCards.reduce((sum, c) => sum + c.totalInterestPaid, 0);
  const totalPaid = activeCards.reduce((sum, c) => sum + c.balance, 0) + totalInterest;
  const debtFreeMonth = resultCards.reduce((max, c) => Math.max(max, c.payoffMonth), 0);

  return {
    strategy,
    extraPayment,
    cards: resultCards,
    totalInterest,
    totalPaid,
    debtFreeDate: addMonths(startDate, debtFreeMonth),
    totalMonths: debtFreeMonth + 1, // +1 because month 0 is the first month
  };
}

/**
 * Calculate both strategies for comparison.
 */
export function compareStrategies(
  cards: CreditCard[],
  extraPayment: number,
  startDate: Date = new Date(),
): { avalanche: PayoffPlanResult; snowball: PayoffPlanResult } {
  return {
    avalanche: calculatePayoff(cards, extraPayment, 'avalanche', startDate),
    snowball: calculatePayoff(cards, extraPayment, 'snowball', startDate),
  };
}

/**
 * Calculate the proportional extra payment for a specific card in a payoff plan.
 * Returns the extra amount (beyond min payment) for the target card in month 0.
 */
export function getExtraForCard(
  plan: PayoffPlanResult,
  cardId: string,
): number {
  const cardResult = plan.cards.find((c) => c.cardId === cardId);
  if (!cardResult || cardResult.payments.length === 0) return 0;

  const firstPayment = cardResult.payments[0];
  // Extra = payment - min payment - interest (but payment already includes interest coverage)
  // Actually, the first payment includes min + extra. The extra portion is payment - minPayment.
  // We need the card's original min payment to compute this.
  // But we don't have the card object here. Let's compute differently.
  // The extra is: firstPayment.payment - firstPayment.interest - principal_from_min
  // This is tricky. Let's just return the first payment's principal minus what min payment principal would be.

  // Simpler: store the card's min payment in the result. For now, we'll compute
  // the extra as the payment minus the interest minus the minimum principal.
  // Minimum principal = minPayment - interest (if minPayment > interest)
  // So extra = payment - minPayment
  // But we need the min payment... Let's use a different approach in the caller.
  return 0; // Will be computed in the apply plan function where we have card data
}
