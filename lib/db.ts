import Dexie, { type Table } from 'dexie';
import type { Account, ScheduledItem, CreditCard, WishlistItem } from './types';

export class CashflowDB extends Dexie {
  accounts!: Table<Account, string>;
  scheduledItems!: Table<ScheduledItem, string>;
  creditCards!: Table<CreditCard, string>;
  wishlistItems!: Table<WishlistItem, string>;

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

export async function getAccount(id: string): Promise<Account | undefined> {
  const db = getDB();
  return db.accounts.get(id);
}

export async function updateAccount(account: Account): Promise<void> {
  const db = getDB();
  await db.accounts.put({ ...account, updatedAt: new Date() });
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
