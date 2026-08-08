import Dexie, { type Table } from 'dexie';
import type { Account, ScheduledItem, CreditCard, WishlistItem, Category } from './types';

// Default categories with emoji icons and colors
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: 'Groceries', icon: '🛒', color: '#22c55e', isCustom: false, isActive: true },
  { name: 'Dining', icon: '🍽️', color: '#f97316', isCustom: false, isActive: true },
  { name: 'Gas/Transport', icon: '⛽', color: '#3b82f6', isCustom: false, isActive: true },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899', isCustom: false, isActive: true },
  { name: 'Entertainment', icon: '🎬', color: '#a855f7', isCustom: false, isActive: true },
  { name: 'Health/Medical', icon: '⚕️', color: '#ef4444', isCustom: false, isActive: true },
  { name: 'Housing/Rent', icon: '🏠', color: '#6366f1', isCustom: false, isActive: true },
  { name: 'Utilities', icon: '💡', color: '#eab308', isCustom: false, isActive: true },
  { name: 'Subscriptions', icon: '📱', color: '#06b6d4', isCustom: false, isActive: true },
  { name: 'Personal Care', icon: '✂️', color: '#14b8a6', isCustom: false, isActive: true },
  { name: 'Kids/Family', icon: '👨‍👩‍👧', color: '#f43f5e', isCustom: false, isActive: true },
  { name: 'Pets', icon: '🐾', color: '#8b5cf6', isCustom: false, isActive: true },
  { name: 'Travel', icon: '✈️', color: '#0ea5e9', isCustom: false, isActive: true },
  { name: 'Income', icon: '💰', color: '#16a34a', isCustom: false, isActive: true },
  { name: 'Transfer', icon: '🔄', color: '#64748b', isCustom: false, isActive: true },
  { name: 'Other', icon: '📦', color: '#94a3b8', isCustom: false, isActive: true },
];

export class CashflowDB extends Dexie {
  accounts!: Table<Account, string>;
  scheduledItems!: Table<ScheduledItem, string>;
  creditCards!: Table<CreditCard, string>;
  wishlistItems!: Table<WishlistItem, string>;
  categories!: Table<Category, string>;

  constructor() {
    super('cashflow-calendar');

    // Phase 1 schema (unchanged)
    this.version(1).stores({
      accounts: 'id, type',
      scheduledItems: 'id, accountId, startDate, recurrence',
    });

    // Phase 2 schema — adds new tables + sourceId/sourceType indexes
    this.version(2).stores({
      accounts: 'id, type',
      scheduledItems: 'id, accountId, startDate, recurrence, sourceId, sourceType',
      creditCards: 'id, isActive',
      wishlistItems: 'id, isActive, priority',
    });

    // Phase 3+4 schema — adds categories table + categoryId index + toAccountId
    this.version(3).stores({
      accounts: 'id, type, isActive',
      scheduledItems: 'id, accountId, startDate, recurrence, sourceId, sourceType, categoryId, toAccountId',
      creditCards: 'id, isActive',
      wishlistItems: 'id, isActive, priority',
      categories: 'id, isActive, isCustom',
    });
  }
}

let dbInstance: CashflowDB | null = null;

export function getDB(): CashflowDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }
  if (!dbInstance) {
    dbInstance = new CashflowDB();
  }
  return dbInstance;
}

// ---- Categories ----

export async function ensureDefaultCategories(): Promise<void> {
  const db = getDB();
  const existing = await db.categories.toArray();
  if (existing.length > 0) return;

  const now = new Date();
  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    createdAt: now,
  }));
  await db.categories.bulkAdd(categories);
}

export async function getAllCategories(): Promise<Category[]> {
  const db = getDB();
  return db.categories.toArray();
}

export async function getActiveCategories(): Promise<Category[]> {
  const db = getDB();
  const all = await db.categories.toArray();
  return all.filter((c) => c.isActive).sort((a, b) => {
    // Default categories first, then custom
    if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export async function addCategory(category: Category): Promise<void> {
  const db = getDB();
  await db.categories.add(category);
}

export async function updateCategory(category: Category): Promise<void> {
  const db = getDB();
  await db.categories.put(category);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = getDB();
  await db.categories.delete(id);
}

// ---- Accounts ----

// Seed a default checking account if none exists
export async function ensureDefaultAccount(): Promise<Account> {
  const db = getDB();
  const existing = await db.accounts.toArray();

  if (existing.length > 0) {
    return existing[0];
  }

  const now = new Date();
  const account: Account = {
    id: crypto.randomUUID(),
    name: 'Checking',
    type: 'checking',
    currentBalance: 0, // user will set this
    lowBalanceThreshold: 10000, // $100 default
    color: '#3b82f6',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.accounts.add(account);
  return account;
}

export async function getAllAccounts(): Promise<Account[]> {
  const db = getDB();
  return db.accounts.toArray();
}

export async function getActiveAccounts(): Promise<Account[]> {
  const db = getDB();
  const all = await db.accounts.toArray();
  return all.filter((a) => a.isActive);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const db = getDB();
  return db.accounts.get(id);
}

export async function updateAccount(account: Account): Promise<void> {
  const db = getDB();
  await db.accounts.put({ ...account, updatedAt: new Date() });
}

export async function addAccount(account: Account): Promise<void> {
  const db = getDB();
  await db.accounts.add(account);
}

export async function deleteAccount(id: string): Promise<void> {
  const db = getDB();
  await db.accounts.delete(id);
}

// ---- Scheduled Items ----

export async function getAllScheduledItems(): Promise<ScheduledItem[]> {
  const db = getDB();
  const all = await db.scheduledItems.toArray();
  return all.filter((i) => i.isActive);
}

export async function addScheduledItem(item: ScheduledItem): Promise<void> {
  const db = getDB();
  await db.scheduledItems.add(item);
}

export async function updateScheduledItem(item: ScheduledItem): Promise<void> {
  const db = getDB();
  await db.scheduledItems.put({ ...item, updatedAt: new Date() });
}

export async function deleteScheduledItem(id: string): Promise<void> {
  const db = getDB();
  await db.scheduledItems.delete(id);
}

export async function deleteScheduledItemsBySource(sourceId: string): Promise<void> {
  const db = getDB();
  const items = await db.scheduledItems.where('sourceId').equals(sourceId).toArray();
  await db.scheduledItems.bulkDelete(items.map((i) => i.id));
}

export async function deactivateScheduledItemsBySource(sourceId: string): Promise<void> {
  const db = getDB();
  const items = await db.scheduledItems.where('sourceId').equals(sourceId).toArray();
  const now = new Date();
  await db.scheduledItems.bulkPut(
    items.map((i) => ({ ...i, isActive: false, updatedAt: now })),
  );
}

export async function activateScheduledItemsBySource(sourceId: string): Promise<void> {
  const db = getDB();
  const items = await db.scheduledItems.where('sourceId').equals(sourceId).toArray();
  const now = new Date();
  await db.scheduledItems.bulkPut(
    items.map((i) => ({ ...i, isActive: true, updatedAt: now })),
  );
}

// ---- Credit Cards ----

export async function getAllCreditCards(): Promise<CreditCard[]> {
  const db = getDB();
  return db.creditCards.toArray();
}

export async function addCreditCard(card: CreditCard): Promise<void> {
  const db = getDB();
  await db.creditCards.add(card);
}

export async function updateCreditCard(card: CreditCard): Promise<void> {
  const db = getDB();
  await db.creditCards.put({ ...card, updatedAt: new Date() });
}

export async function deleteCreditCard(id: string): Promise<void> {
  const db = getDB();
  await db.creditCards.delete(id);
}

export async function bulkAddCreditCards(cards: CreditCard[]): Promise<void> {
  const db = getDB();
  await db.creditCards.bulkAdd(cards);
}

// ---- Wishlist Items ----

export async function getAllWishlistItems(): Promise<WishlistItem[]> {
  const db = getDB();
  return db.wishlistItems.toArray();
}

export async function addWishlistItem(item: WishlistItem): Promise<void> {
  const db = getDB();
  await db.wishlistItems.add(item);
}

export async function updateWishlistItem(item: WishlistItem): Promise<void> {
  const db = getDB();
  await db.wishlistItems.put({ ...item, updatedAt: new Date() });
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const db = getDB();
  await db.wishlistItems.delete(id);
}
