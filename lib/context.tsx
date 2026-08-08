'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Account, ScheduledItem, CreditCard, WishlistItem } from './types';
import {
  getDB,
  ensureDefaultAccount,
  addScheduledItem as dbAdd,
  updateScheduledItem as dbUpdate,
  deleteScheduledItem as dbDelete,
  updateAccount as dbUpdateAccount,
  deleteScheduledItemsBySource,
  deactivateScheduledItemsBySource,
  activateScheduledItemsBySource,
  getAllCreditCards,
  addCreditCard,
  updateCreditCard,
  deleteCreditCard,
  bulkAddCreditCards,
  getAllWishlistItems,
  addWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
} from './db';

// ---- Cashflow Context (Phase 1, extended) ----

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
      setScheduledItems(items);
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

// ---- Card Context (Phase 2) ----

interface CardContextValue {
  cards: CreditCard[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCard: (card: CreditCard) => Promise<void>;
  updateCard: (card: CreditCard) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  bulkAddCards: (cards: CreditCard[]) => Promise<void>;
}

const CardContext = createContext<CardContextValue | null>(null);

export function CardProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getAllCreditCards();
      setCards(all.sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCard = useCallback(async (card: CreditCard) => {
    await addCreditCard(card);
    await refresh();
  }, [refresh]);

  const updateCard = useCallback(async (card: CreditCard) => {
    await updateCreditCard(card);
    await refresh();
  }, [refresh]);

  const deleteCard = useCallback(async (id: string) => {
    // Also delete associated scheduled items
    await deleteScheduledItemsBySource(id);
    await deleteCreditCard(id);
    await refresh();
  }, [refresh]);

  const bulkAddCards = useCallback(async (newCards: CreditCard[]) => {
    await bulkAddCreditCards(newCards);
    await refresh();
  }, [refresh]);

  return (
    <CardContext.Provider
      value={{ cards, loading, error, refresh, addCard, updateCard, deleteCard, bulkAddCards }}
    >
      {children}
    </CardContext.Provider>
  );
}

export function useCards() {
  const ctx = useContext(CardContext);
  if (!ctx) throw new Error('useCards must be used within CardProvider');
  return ctx;
}

// ---- Wishlist Context (Phase 2) ----

interface WishlistContextValue {
  items: WishlistItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (item: WishlistItem) => Promise<void>;
  updateItem: (item: WishlistItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const all = await getAllWishlistItems();
      setItems(all.sort((a, b) => a.priority - b.priority));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (item: WishlistItem) => {
    await addWishlistItem(item);
    await refresh();
  }, [refresh]);

  const updateItem = useCallback(async (item: WishlistItem) => {
    await updateWishlistItem(item);
    await refresh();
  }, [refresh]);

  const deleteItem = useCallback(async (id: string) => {
    // Also delete associated scheduled items
    await deleteScheduledItemsBySource(id);
    await deleteWishlistItem(id);
    await refresh();
  }, [refresh]);

  return (
    <WishlistContext.Provider
      value={{ items, loading, error, refresh, addItem, updateItem, deleteItem }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}

// ---- Combined provider for convenience ----

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <CashflowProvider>
      <CardProvider>
        <WishlistProvider>
          {children}
        </WishlistProvider>
      </CardProvider>
    </CashflowProvider>
  );
}
