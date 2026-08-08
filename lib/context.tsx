'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Account, ScheduledItem, CreditCard, WishlistItem, Category } from './types';
import {
  getDB,
  ensureDefaultAccount,
  ensureDefaultCategories,
  getAllAccounts,
  getActiveAccounts,
  addAccount as dbAddAccount,
  updateAccount as dbUpdateAccount,
  deleteAccount as dbDeleteAccount,
  addScheduledItem as dbAdd,
  updateScheduledItem as dbUpdate,
  deleteScheduledItem as dbDelete,
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
  getAllCategories,
  getActiveCategories,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
} from './db';

// ---- Cashflow Context (Phase 1, extended Phase 4) ----

interface CashflowContextValue {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedAccount: Account | null;
  scheduledItems: ScheduledItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setSelectedAccountId: (id: string | null) => void;
  addScheduledItem: (item: ScheduledItem) => Promise<void>;
  updateScheduledItem: (item: ScheduledItem) => Promise<void>;
  deleteScheduledItem: (id: string) => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
}

const CashflowContext = createContext<CashflowContextValue | null>(null);

export function CashflowProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const db = getDB();
      await ensureDefaultAccount();
      await ensureDefaultCategories();
      const activeAccounts = await getActiveAccounts();
      const items = await db.scheduledItems.toArray();
      setAccounts(activeAccounts);

      // Auto-select first account if none selected or selected was deleted
      setSelectedAccountId((prev) => {
        if (prev && activeAccounts.some((a) => a.id === prev)) return prev;
        return activeAccounts[0]?.id ?? null;
      });

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

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

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

  const addAccount = useCallback(async (account: Account) => {
    await dbAddAccount(account);
    await refresh();
  }, [refresh]);

  const updateAccount = useCallback(async (account: Account) => {
    await dbUpdateAccount(account);
    await refresh();
  }, [refresh]);

  const deleteAccount = useCallback(async (id: string) => {
    await dbDeleteAccount(id);
    await refresh();
  }, [refresh]);

  return (
    <CashflowContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedAccount,
        scheduledItems,
        loading,
        error,
        refresh,
        setSelectedAccountId,
        addScheduledItem,
        updateScheduledItem,
        deleteScheduledItem,
        addAccount,
        updateAccount,
        deleteAccount,
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

// ---- Category Context (Phase 4) ----

interface CategoryContextValue {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await ensureDefaultCategories();
      const active = await getActiveCategories();
      setCategories(active);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCategory = useCallback(async (category: Category) => {
    await dbAddCategory(category);
    await refresh();
  }, [refresh]);

  const updateCategory = useCallback(async (category: Category) => {
    await dbUpdateCategory(category);
    await refresh();
  }, [refresh]);

  const deleteCategory = useCallback(async (id: string) => {
    await dbDeleteCategory(id);
    await refresh();
  }, [refresh]);

  return (
    <CategoryContext.Provider
      value={{ categories, loading, error, refresh, addCategory, updateCategory, deleteCategory }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error('useCategories must be used within CategoryProvider');
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
      <CategoryProvider>
        <CardProvider>
          <WishlistProvider>
            {children}
          </WishlistProvider>
        </CardProvider>
      </CategoryProvider>
    </CashflowProvider>
  );
}
