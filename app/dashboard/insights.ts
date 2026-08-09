import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  addDays,
  isWithinInterval,
  format,
  subMonths,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from 'date-fns';
import type {
  Account,
  ScheduledItem,
  CreditCard,
  WishlistItem,
  Category,
} from '@/lib/types';
import { projectBalances, expandScheduledItem } from '@/lib/calculations';

export type InsightTone = 'good' | 'warning' | 'alert' | 'info';

export interface Insight {
  id: string;
  icon: string;
  title: string;
  value: string;
  description: string;
  tone: InsightTone;
}

export interface InsightSection {
  title: string;
  insights: Insight[];
}

// ---- Helpers ----

/** Get all expense instances for a given month across all accounts. */
function getMonthExpenses(
  scheduledItems: ScheduledItem[],
  month: Date,
): { categoryId?: string; amount: number; description: string }[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const today = startOfDay(new Date());
  const projStart = monthStart < today ? monthStart : today;
  const projDays = Math.max(
    90,
    Math.round((monthEnd.getTime() - projStart.getTime()) / (1000 * 60 * 60 * 24)) + 5,
  );

  // We don't have a specific account here, so expand all items manually
  const expenses: { categoryId?: string; amount: number; description: string }[] = [];
  for (const item of scheduledItems) {
    if (!item.isActive || item.type !== 'expense') continue;
    const instances = expandScheduledItem(item, monthStart, monthEnd);
    for (const inst of instances) {
      if (isWithinInterval(inst.date, { start: monthStart, end: monthEnd })) {
        expenses.push({
          categoryId: inst.categoryId,
          amount: inst.amount,
          description: inst.description,
        });
      }
    }
  }
  return expenses;
}

/** Get all income instances for a given month across all accounts. */
function getMonthIncome(scheduledItems: ScheduledItem[], month: Date): number {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  let total = 0;
  for (const item of scheduledItems) {
    if (!item.isActive || item.type !== 'income') continue;
    const instances = expandScheduledItem(item, monthStart, monthEnd);
    for (const inst of instances) {
      if (isWithinInterval(inst.date, { start: monthStart, end: monthEnd })) {
        total += inst.amount;
      }
    }
  }
  return total;
}

/** Find category by id, return fallback. */
function findCategory(
  categories: Category[],
  id?: string,
): { name: string; icon: string } {
  if (!id) return { name: 'Uncategorized', icon: '📦' };
  const cat = categories.find((c) => c.id === id);
  return cat
    ? { name: cat.name, icon: cat.icon }
    : { name: 'Uncategorized', icon: '📦' };
}

// ---- Section: Spending Overview ----

export function spendingOverview(
  scheduledItems: ScheduledItem[],
  categories: Category[],
): InsightSection {
  const now = new Date();
  const thisMonth = now;
  const lastMonth = subMonths(now, 1);

  const expenses = getMonthExpenses(scheduledItems, thisMonth);
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  // Top category
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    const key = e.categoryId ?? '__none';
    byCategory.set(key, (byCategory.get(key) ?? 0) + e.amount);
  }
  let topCatId = '';
  let topCatAmount = 0;
  for (const [id, amt] of byCategory) {
    if (amt > topCatAmount) {
      topCatAmount = amt;
      topCatId = id;
    }
  }
  const topCat = findCategory(categories, topCatId === '__none' ? undefined : topCatId);
  const topCatPct = totalSpend > 0 ? Math.round((topCatAmount / totalSpend) * 100) : 0;

  // Month-over-month
  const lastExpenses = getMonthExpenses(scheduledItems, lastMonth);
  const lastTotal = lastExpenses.reduce((s, e) => s + e.amount, 0);
  const momChange = totalSpend - lastTotal;
  const momPct = lastTotal > 0 ? Math.round((momChange / lastTotal) * 100) : 0;

  // Daily average
  const daysElapsed = now.getDate();
  const dailyAvg = daysElapsed > 0 ? Math.round(totalSpend / daysElapsed) : 0;

  const insights: Insight[] = [];

  insights.push({
    id: 'top-category',
    icon: topCat.icon,
    title: 'Top Spending Category',
    value: topCatId ? `${topCat.name} · ${topCatPct}%` : 'No data yet',
    description: topCatId
      ? `You've spent $${(topCatAmount / 100).toFixed(2)} on ${topCat.name} this month.`
      : 'No expenses recorded for this month yet.',
    tone: topCatPct > 40 ? 'warning' : 'info',
  });

  insights.push({
    id: 'mom-change',
    icon: momChange > 0 ? '📈' : '📉',
    title: 'Month-over-Month Change',
    value:
      lastTotal === 0
        ? 'No prior data'
        : `${momChange > 0 ? '+' : '-'}$${Math.abs(momChange / 100).toFixed(2)} (${Math.abs(momPct)}%)`,
    description:
      lastTotal === 0
        ? 'No expenses recorded last month to compare.'
        : momChange > 0
          ? `You're spending more than last month ($${(lastTotal / 100).toFixed(2)}).`
          : momChange < 0
            ? `Great! You're spending less than last month ($${(lastTotal / 100).toFixed(2)}).`
            : `Your spending is identical to last month.`,
    tone: momChange > 0 ? 'warning' : momChange < 0 ? 'good' : 'info',
  });

  insights.push({
    id: 'daily-avg',
    icon: '📅',
    title: 'Daily Average Spend',
    value: `$${(dailyAvg / 100).toFixed(2)}`,
    description: `Based on ${daysElapsed} day${daysElapsed !== 1 ? 's' : ''} elapsed this month.`,
    tone: 'info',
  });

  return { title: 'Spending Overview', insights };
}

// ---- Section: Cash Flow Health ----

export function cashFlowHealth(
  accounts: Account[],
  scheduledItems: ScheduledItem[],
): InsightSection {
  const insights: Insight[] = [];
  const now = new Date();

  // Combined balance across all accounts
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
  insights.push({
    id: 'total-balance',
    icon: '🏦',
    title: 'Total Balance',
    value: `$${(totalBalance / 100).toFixed(2)}`,
    description: `Across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}.`,
    tone: totalBalance > 0 ? 'good' : 'alert',
  });

  // Projected lowest balance per account in next 30 days
  for (const account of accounts) {
    const balances = projectBalances(account, scheduledItems, now, 30);
    let lowest = balances[0];
    for (const b of balances) {
      if (b.balance < lowest.balance) lowest = b;
    }

    const nearThreshold =
      Math.abs(lowest.balance - account.lowBalanceThreshold) < 20000;

    insights.push({
      id: `lowest-balance-${account.id}`,
      icon: lowest.isBelowZero ? '🚨' : lowest.isLowBalance ? '⚠️' : '✅',
      title: `${account.name} — Lowest Balance`,
      value: `$${(lowest.balance / 100).toFixed(2)}`,
      description: lowest.isBelowZero
        ? `${account.name} goes negative around ${format(lowest.date, 'MMM d')}.`
        : lowest.isLowBalance
          ? `${account.name} drops below your safety threshold around ${format(lowest.date, 'MMM d')}.`
          : `Lowest point around ${format(lowest.date, 'MMM d')}. You're in the clear.`,
      tone: lowest.isBelowZero ? 'alert' : lowest.isLowBalance ? 'warning' : 'good',
    });

    if (nearThreshold && !lowest.isBelowZero) {
      insights.push({
        id: `threshold-warning-${account.id}`,
        icon: '💡',
        title: `${account.name} — Approaching Threshold`,
        value: `$${(lowest.balance / 100).toFixed(2)}`,
        description: `Heads up — ${account.name} dips close to your safety threshold around ${format(lowest.date, 'MMM d')}.`,
        tone: 'warning',
      });
    }
  }

  if (accounts.length === 0) {
    insights.push({
      id: 'no-account',
      icon: '🏦',
      title: 'No Accounts',
      value: '—',
      description: 'Add an account to see balance projections.',
      tone: 'info',
    });
  }

  // Bills this week (next 7 days)
  const weekStart = startOfDay(now);
  const weekEnd = addDays(weekStart, 7);
  let billCount = 0;
  let billTotal = 0;
  for (const item of scheduledItems) {
    if (!item.isActive || item.type !== 'expense') continue;
    const instances = expandScheduledItem(item, weekStart, weekEnd);
    for (const inst of instances) {
      if (isWithinInterval(inst.date, { start: weekStart, end: weekEnd })) {
        billCount++;
        billTotal += inst.amount;
      }
    }
  }

  insights.push({
    id: 'bills-this-week',
    icon: '🧾',
    title: 'Bills This Week',
    value: billCount > 0 ? `${billCount} bill${billCount !== 1 ? 's' : ''} · $${(billTotal / 100).toFixed(2)}` : 'No bills',
    description:
      billCount > 0
        ? `Total of $${(billTotal / 100).toFixed(2)} due in the next 7 days.`
        : 'No expenses scheduled for the next 7 days.',
    tone: billTotal > 0 ? 'info' : 'good',
  });

  // Income vs expenses this month
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  let monthIncome = 0;
  let monthExpenses = 0;
  for (const item of scheduledItems) {
    if (!item.isActive) continue;
    const instances = expandScheduledItem(item, monthStart, monthEnd);
    for (const inst of instances) {
      if (!isWithinInterval(inst.date, { start: monthStart, end: monthEnd })) continue;
      if (inst.type === 'income') monthIncome += inst.amount;
      else if (inst.type === 'expense') monthExpenses += inst.amount;
    }
  }
  const surplus = monthIncome - monthExpenses;

  insights.push({
    id: 'income-vs-expenses',
    icon: surplus >= 0 ? '💚' : '❤️',
    title: 'Income vs Expenses',
    value: surplus >= 0 ? `+$${(surplus / 100).toFixed(2)} surplus` : `-$${Math.abs(surplus / 100).toFixed(2)} deficit`,
    description: `Income: $${(monthIncome / 100).toFixed(2)} · Expenses: $${(monthExpenses / 100).toFixed(2)} this month.`,
    tone: surplus >= 0 ? 'good' : 'alert',
  });

  return { title: 'Cash Flow Health', insights };
}

// ---- Section: Debt & Savings ----

export function debtAndSavings(
  cards: CreditCard[],
  wishlist: WishlistItem[],
): InsightSection {
  const insights: Insight[] = [];
  const activeCards = cards.filter((c) => c.isActive);
  const activeWishlist = wishlist.filter((w) => w.isActive && !w.isPurchased);

  // Total credit card debt
  const totalDebt = activeCards.reduce((s, c) => s + c.balance, 0);
  insights.push({
    id: 'total-debt',
    icon: '💳',
    title: 'Total Credit Card Debt',
    value: `$${(totalDebt / 100).toFixed(2)}`,
    description:
      activeCards.length > 0
        ? `Across ${activeCards.length} card${activeCards.length !== 1 ? 's' : ''}.`
        : 'No active credit cards.',
    tone: totalDebt > 0 ? 'warning' : 'good',
  });

  // Highest APR card
  if (activeCards.length > 0) {
    const highestAPR = activeCards.reduce((max, c) => (c.apr > max.apr ? c : max));
    insights.push({
      id: 'highest-apr',
      icon: '🔥',
      title: 'Highest APR Card',
      value: `${highestAPR.name} · ${highestAPR.apr.toFixed(2)}%`,
      description:
        highestAPR.apr > 20
          ? `Focus extra payments here to save the most on interest.`
          : `Consider paying this off first to free up cash flow.`,
      tone: highestAPR.apr > 20 ? 'alert' : 'warning',
    });

    // Interest savings nudge for high APR cards
    if (highestAPR.apr > 20 && highestAPR.balance > 0) {
      // Rough estimate: paying an extra $50/mo saves roughly (balance * apr% / 12 * months_saved)
      // Simplified: interest per month on current balance
      const monthlyInterest = Math.round((highestAPR.balance * highestAPR.apr / 100) / 12);
      insights.push({
        id: 'apr-nudge',
        icon: '💡',
        title: 'Interest Saving Tip',
        value: `$${(monthlyInterest / 100).toFixed(2)}/mo in interest`,
        description: `Your ${highestAPR.name} has a ${highestAPR.apr.toFixed(2)}% APR. Paying an extra $50/mo saves you money every month.`,
        tone: 'info',
      });
    }
  }

  // Wishlist progress
  if (activeWishlist.length > 0) {
    const totalGoal = activeWishlist.reduce((s, w) => s + w.estimatedCost, 0);
    const totalSaved = activeWishlist.reduce((s, w) => s + w.savedSoFar, 0);
    const pct = totalGoal > 0 ? Math.round((totalSaved / totalGoal) * 100) : 0;
    insights.push({
      id: 'wishlist-progress',
      icon: '⭐',
      title: 'Wishlist Progress',
      value: `$${(totalSaved / 100).toFixed(2)} / $${(totalGoal / 100).toFixed(2)}`,
      description: `${pct}% saved across ${activeWishlist.length} item${activeWishlist.length !== 1 ? 's' : ''}.`,
      tone: pct >= 75 ? 'good' : pct >= 25 ? 'info' : 'warning',
    });
  } else {
    insights.push({
      id: 'wishlist-empty',
      icon: '⭐',
      title: 'Wishlist Progress',
      value: 'No active goals',
      description: 'Add items to your wishlist to start tracking savings goals.',
      tone: 'info',
    });
  }

  return { title: 'Debt & Savings', insights };
}

// ---- Section: Smart Nudges ----

export function smartNudges(
  scheduledItems: ScheduledItem[],
  categories: Category[],
  cards: CreditCard[],
  accounts: Account[],
): InsightSection {
  const nudges: Insight[] = [];
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get this month's expenses by category
  const expenses = getMonthExpenses(scheduledItems, now);
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    const key = e.categoryId ?? '__none';
    byCategory.set(key, (byCategory.get(key) ?? 0) + e.amount);
  }

  // Category names for lookup
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Nudge: Dining/entertainment > 15%
  for (const [catId, amount] of byCategory) {
    const cat = catId !== '__none' ? catMap.get(catId) : null;
    const name = cat?.name?.toLowerCase() ?? '';
    if (
      (name.includes('dining') || name.includes('food') || name.includes('entertainment') || name.includes('restaurant')) &&
      totalSpend > 0 &&
      amount / totalSpend > 0.15
    ) {
      const pct = Math.round((amount / totalSpend) * 100);
      nudges.push({
        id: 'dining-nudge',
        icon: '🍽️',
        title: 'Dining Out is Adding Up',
        value: `${pct}% of spending`,
        description: `Dining out is ${pct}% of your spending this month ($${(amount / 100).toFixed(2)}). Small cuts here add up fast.`,
        tone: 'warning',
      });
      break;
    }
  }

  // Nudge: Subscriptions
  for (const [catId, amount] of byCategory) {
    const cat = catId !== '__none' ? catMap.get(catId) : null;
    const name = cat?.name?.toLowerCase() ?? '';
    if (name.includes('subscription') || name.includes('subscriptions')) {
      nudges.push({
        id: 'subscription-nudge',
        icon: '🔄',
        title: 'Subscription Check',
        value: `$${(amount / 100).toFixed(2)}/mo`,
        description: `You have $${(amount / 100).toFixed(2)}/mo in subscriptions. Review any you're not using?`,
        tone: 'info',
      });
      break;
    }
  }

  // Nudge: Surplus → savings
  const monthIncome = getMonthIncome(scheduledItems, now);
  if (monthIncome > 0) {
    const surplus = monthIncome - totalSpend;
    if (surplus > 0) {
      nudges.push({
        id: 'surplus-nudge',
        icon: '🌱',
        title: 'You Have Surplus Cash',
        value: `~$${(surplus / 100).toFixed(2)} surplus`,
        description: `You have ~$${(surplus / 100).toFixed(2)} surplus this month. Even $50 into savings/investing builds momentum.`,
        tone: 'good',
      });
    }
  }

  // Nudge: High APR card
  const activeCards = cards.filter((c) => c.isActive);
  for (const card of activeCards) {
    if (card.apr > 20 && card.balance > 0) {
      const monthlyInterest = Math.round((card.balance * card.apr / 100) / 12);
      nudges.push({
        id: `apr-nudge-${card.id}`,
        icon: '🔥',
        title: 'High APR Alert',
        value: `${card.apr.toFixed(2)}% APR`,
        description: `Your ${card.name} has a ${card.apr.toFixed(2)}% APR. Paying an extra $50/mo saves $${(monthlyInterest / 100).toFixed(2)}/mo in interest.`,
        tone: 'alert',
      });
      break;
    }
  }

  // Nudge: Low balance approaching threshold (check all accounts)
  for (const account of accounts) {
    const balances = projectBalances(account, scheduledItems, now, 30);
    let lowest = balances[0];
    for (const b of balances) {
      if (b.balance < lowest.balance) lowest = b;
    }
    if (
      !lowest.isBelowZero &&
      Math.abs(lowest.balance - account.lowBalanceThreshold) < 20000 &&
      lowest.balance <= account.lowBalanceThreshold
    ) {
      nudges.push({
        id: `threshold-nudge-${account.id}`,
        icon: '⚠️',
        title: `${account.name} Near Threshold`,
        value: `$${(lowest.balance / 100).toFixed(2)}`,
        description: `Heads up — ${account.name} dips close to your safety threshold around ${format(lowest.date, 'MMM d')}.`,
        tone: 'warning',
      });
    }
  }

  // If no nudges, add a positive one
  if (nudges.length === 0) {
    nudges.push({
      id: 'all-good',
      icon: '✨',
      title: 'You\'re on Track',
      value: 'No alerts',
      description: 'No concerning patterns detected. Keep up the good work!',
      tone: 'good',
    });
  }

  return { title: 'Smart Nudges', insights: nudges };
}
