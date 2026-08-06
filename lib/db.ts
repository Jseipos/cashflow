import Dexie, { type Table } from 'dexie';
import type { Account, ScheduledItem } from './types';

export class CashflowDB extends Dexie {
  accounts!: Table<Account, string>;
  scheduledItems!: Table<ScheduledItem, string>;

  constructor() {
    super('cashflow-calendar');
    this.version(1).stores({
      accounts: 'id, type',
      scheduledItems: 'id, accountId, startDate, recurrence',
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
