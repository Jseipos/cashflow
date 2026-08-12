'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AppProviders, useCashflow, useCategories, useCards } from '@/lib/context';
import { CategoryPicker } from '@/app/components/CategoryPicker';
import { formatCurrency } from '@/lib/calculations';
import type { ScheduledItem } from '@/lib/types';

type ScanStep = 'idle' | 'camera' | 'captured' | 'confirm' | 'payment';

function ScanPageInner() {
  const { accounts, selectedAccountId, addScheduledItem } = useCashflow();
  const { categories } = useCategories();
  const { cards, recordCardExpense, recordCardPayment } = useCards();

  const [step, setStep] = useState<ScanStep>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // Confirmation form state
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [isCardPayment, setIsCardPayment] = useState(false);
  const [cardId, setCardId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment form state
  const [paymentCardId, setPaymentCardId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize selected account
  useEffect(() => {
    if (!accountId && selectedAccountId) setAccountId(selectedAccountId);
  }, [selectedAccountId, accountId]);

  // Start camera
  const startCamera = useCallback(async () => {
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
      setStep('idle');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setImageDataUrl(dataUrl);
    stopCamera();
    setStep('captured');
  }, [stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setImageDataUrl(null);
    startCamera();
  }, [startCamera]);

  // Skip camera and go straight to manual entry
  const skipCamera = useCallback(() => {
    setAmount('');
    setMerchant('');
    setDate(formatDateForInput(new Date()));
    setStep('confirm');
  }, []);

  // Save the expense
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountId && !cardId) {
      setError('Select an account or card');
      return;
    }

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (!merchant.trim()) {
      setError('Enter a merchant/description');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const parsedDate = date ? new Date(date + 'T00:00:00') : new Date();

      const item: ScheduledItem = {
        id: crypto.randomUUID(),
        accountId: accountId || accounts[0]?.id || '',
        type: 'expense',
        amount: amountCents,
        description: merchant.trim(),
        categoryId: categoryId ?? undefined,
        recurrence: 'once',
        startDate: parsedDate,
        endDate: null,
        isActive: true,
        lastProcessedDate: null,
        createdAt: now,
        updatedAt: now,
      };

      await addScheduledItem(item);

      // If paid with a credit card, record the card transaction and update balance
      if (isCardPayment && cardId) {
        await recordCardExpense(cardId, amountCents, merchant.trim(), parsedDate, item.id);
      }

      // Reset everything
      setStep('idle');
      setImageDataUrl(null);
      setAmount('');
      setMerchant('');
      setCategoryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Initialize payment form when entering payment step
  const startPayment = useCallback(() => {
    setPaymentCardId('');
    setPaymentAmount('');
    setPaymentDate(formatDateForInput(new Date()));
    setPaymentAccountId('');
    setPaymentError(null);
    setStep('payment');
  }, []);

  // Handle payment submission
  const handlePaymentSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (!paymentCardId) {
      setPaymentError('Select a card to pay');
      return;
    }

    const amountCents = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setPaymentError('Enter a valid amount');
      return;
    }

    setPaymentSaving(true);
    try {
      const parsedDate = paymentDate ? new Date(paymentDate + 'T00:00:00') : new Date();
      await recordCardPayment(paymentCardId, amountCents, parsedDate, paymentAccountId || undefined);

      // Reset
      setStep('idle');
      setPaymentCardId('');
      setPaymentAmount('');
      setPaymentAccountId('');
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to save payment');
    } finally {
      setPaymentSaving(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const activeCards = cards.filter((c) => c.isActive);

  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-400 text-sm">Add an account first to use scanning.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Add Expense</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* IDLE STATE — Start scanning button */}
        {step === 'idle' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <span className="text-5xl">📷</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Add an Expense
            </h2>
            <p className="text-sm text-gray-500 text-center max-w-xs mb-6">
              Take a photo of your receipt for reference, or enter details manually.
            </p>
            <button
              onClick={startCamera}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Open Camera
            </button>
            <button
              onClick={skipCamera}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Enter manually instead
            </button>
            {activeCards.length > 0 && (
              <button
                onClick={startPayment}
                className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Make a card payment →
              </button>
            )}
          </div>
        )}

        {/* CAMERA STATE — Live camera feed */}
        {step === 'camera' && (
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-black aspect-[3/4]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlay frame */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-8 border-2 border-white/60 rounded-lg" />
                <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-xs">
                  Position receipt within the frame
                </p>
              </div>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { stopCamera(); setStep('idle'); }}
                className="px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* CAPTURED STATE — Review photo before confirming */}
        {step === 'captured' && imageDataUrl && (
          <div className="flex flex-col items-center">
            <img
              src={imageDataUrl}
              alt="Captured receipt"
              className="w-full max-w-sm rounded-2xl shadow-lg"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={retakePhoto}
                className="px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={() => {
                  setAmount('');
                  setMerchant('');
                  setDate(formatDateForInput(new Date()));
                  setStep('confirm');
                }}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Enter Details
              </button>
            </div>
          </div>
        )}

        {/* CONFIRM STATE — Editable form */}
        {step === 'confirm' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Preview image (small) */}
            {imageDataUrl && (
              <div className="px-5 pt-5">
                <img
                  src={imageDataUrl}
                  alt="Receipt preview"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}

            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Expense Details</h2>
                {imageDataUrl && (
                  <button
                    onClick={retakePhoto}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    New Photo
                  </button>
                )}
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                      autoFocus
                    />
                  </div>
                  {amount && !isNaN(parseFloat(amount)) && (
                    <p className="text-xs text-gray-400 mt-1">{formatCurrency(Math.round(parseFloat(amount) * 100))}</p>
                  )}
                </div>

                {/* Merchant */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Merchant / Description
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Walmart, Shell, Starbucks"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>

                {/* Account / Card selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Paid With
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => { setIsCardPayment(false); setCardId(''); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !isCardPayment ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Account
                    </button>
                    {activeCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIsCardPayment(true); setAccountId(''); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isCardPayment ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Credit Card
                      </button>
                    )}
                  </div>
                  {!isCardPayment ? (
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={cardId}
                      onChange={(e) => setCardId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                    >
                      <option value="">Select a card...</option>
                      {activeCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Category */}
                <CategoryPicker
                  categories={categories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                />

                {error && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep('idle'); setImageDataUrl(null); }}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* PAYMENT STATE — Card payment form */}
        {step === 'payment' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Make a Card Payment</h2>
                <button
                  onClick={() => setStep('idle')}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                  aria-label="Close"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handlePaymentSave} className="space-y-4">
                {/* Select card */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Pay Toward
                  </label>
                  <select
                    value={paymentCardId}
                    onChange={(e) => {
                      setPaymentCardId(e.target.value);
                      // Default payment account to card's paymentAccountId
                      const card = activeCards.find((c) => c.id === e.target.value);
                      if (card?.paymentAccountId) {
                        setPaymentAccountId(card.paymentAccountId);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                  >
                    <option value="">Select a card...</option>
                    {activeCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — Balance {formatCurrency(c.balance)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Payment Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                      autoFocus
                    />
                  </div>
                  {paymentCardId && activeCards.find((c) => c.id === paymentCardId)?.minimumPayment && (
                    <button
                      type="button"
                      onClick={() => {
                        const card = activeCards.find((c) => c.id === paymentCardId);
                        if (card) setPaymentAmount((card.minimumPayment / 100).toFixed(2));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      Pay minimum ({formatCurrency(activeCards.find((c) => c.id === paymentCardId)!.minimumPayment)})
                    </button>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900"
                  />
                </div>

                {/* From account */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    From Account
                  </label>
                  <select
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-gray-900 bg-white"
                  >
                    <option value="">No account (manual entry)</option>
                    {accounts.filter((a) => a.isActive).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                {paymentError && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
                    {paymentError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('idle')}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentSaving}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {paymentSaving ? 'Saving...' : 'Log Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ScanPage() {
  return (
    <AppProviders>
      <ScanPageInner />
    </AppProviders>
  );
}
