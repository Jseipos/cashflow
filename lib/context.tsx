'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Account, ScheduledItem } from './types';
import {
  getDB,
  ensureDefaultAccount,
  getAllScheduledItems,
  addScheduledItem as dbAdd,
  updateScheduledItem as dbUpdate,
  deleteScheduledItem as dbDelete,
  updateAccount as dbUpdateAccount,
} from './db';

interface CashflowContextValue {
  account: Account | null;
  scheduledItems: ScheduledItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addScheduledItem: (item: ScheduledItem) => Promise<void>;
  updateScheduledItem: (item: ScheduledItem) => Promise<void>;
  deleteScheduledItem: (id: string) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
}

const CashflowContext = createContext<CashflowContextValue | null>(null);

export function CashflowProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const db = getDB();
      const acct = await ensureDefaultAccount();
      const items = await db.scheduledItems.toArray();
      setAccount(acct);
      setScheduledItems(items.filter((i) => i.isActive));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addScheduledItem = useCallback(async (item: ScheduledItem) => {
    await dbAdd(item);
    await refresh();
  }, [refresh]);

  const updateScheduledItem = useCallback(async (item: ScheduledItem) => {
    await dbUpdate(item);
    await refresh();
  }, [refresh]);

  const deleteScheduledItem = useCallback(async (id: string) => {
    await dbDelete(id);
    await refresh();
  }, [refresh]);

  const updateAccount = useCallback(async (acct: Account) => {
    await dbUpdateAccount(acct);
    setAccount(acct);
  }, []);

  return (
    <CashflowContext.Provider
      value={{
        account,
        scheduledItems,
        loading,
        error,
        refresh,
        addScheduledItem,
        updateScheduledItem,
        deleteScheduledItem,
        updateAccount,
      }}
    >
      {children}
    </CashflowContext.Provider>
  );
}

export function useCashflow() {
  const ctx = useContext(CashflowContext);
  if (!ctx) throw new Error('useCashflow must be used within CashflowProvider');
  return ctx;
}
