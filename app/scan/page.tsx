'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AppProviders, useCashflow, useCategories, useCards } from '@/lib/context';
import { CategoryPicker } from '@/app/components/CategoryPicker';
import { formatCurrency } from '@/lib/calculations';
import type { ScheduledItem } from '@/lib/types';

type ScanStep = 'idle' | 'camera' | 'captured' | 'processing' | 'confirm';

interface ParsedReceipt {
  amount: string | null;
  merchant: string | null;
  date: string | null;
}

function ScanPageInner() {
  const { accounts, selectedAccountId, setSelectedAccountId, addScheduledItem } = useCashflow();
  const { categories } = useCategories();
  const { cards } = useCards();

  const [step, setStep] = useState<ScanStep>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt>({ amount: null, merchant: null, date: null });

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
    setOcrError(null);
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
    } catch (e) {
      setOcrError('Camera access denied. Please allow camera permissions and try again.');
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
    setParsed({ amount: null, merchant: null, date: null });
    startCamera();
  }, [startCamera]);

  // Parse receipt with Tesseract.js (lazy-loaded)
  const runOCR = useCallback(async () => {
    if (!imageDataUrl) return;
    setStep('processing');
    setOcrProgress(0);
    setOcrError(null);

    try {
      // Lazy-load Tesseract.js to avoid bundle bloat
      const Tesseract = await import('tesseract.js');

      const result = await Tesseract.recognize(imageDataUrl, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      const parsedReceipt = parseReceiptText(text);
      setParsed(parsedReceipt);

      // Pre-fill form
      setAmount(parsedReceipt.amount ?? '');
      setMerchant(parsedReceipt.merchant ?? '');
      setDate(parsedReceipt.date ?? formatDateForInput(new Date()));
      setStep('confirm');
    } catch (e) {
      setOcrError('OCR failed. Please enter details manually.');
      setAmount('');
      setMerchant('');
      setDate(formatDateForInput(new Date()));
      setStep('confirm');
    }
  }, [imageDataUrl]);

  // Skip OCR and go straight to manual entry
  const skipOCR = useCallback(() => {
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

      // Reset everything
      setStep('idle');
      setImageDataUrl(null);
      setAmount('');
      setMerchant('');
      setCategoryId(null);
      setParsed({ amount: null, merchant: null, date: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
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
          <h1 className="text-lg font-bold text-gray-900">Scan Receipt</h1>
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
              Scan a Receipt
            </h2>
            <p className="text-sm text-gray-500 text-center max-w-xs mb-6">
              Take a photo of your receipt and we&apos;ll automatically extract the amount, merchant, and date.
            </p>
            <button
              onClick={startCamera}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              Open Camera
            </button>
            <button
              onClick={skipOCR}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Enter manually instead
            </button>
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
            {ocrError && (
              <p className="text-red-500 text-sm mt-3 text-center">{ocrError}</p>
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

        {/* CAPTURED STATE — Review photo before OCR */}
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
                onClick={runOCR}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Extract Details
              </button>
            </div>
          </div>
        )}

        {/* PROCESSING STATE — OCR in progress */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Reading receipt...
            </h2>
            <p className="text-sm text-gray-500">{ocrProgress}%</p>
          </div>
        )}

        {/* CONFIRM STATE — Editable form with parsed data */}
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
                <h2 className="text-lg font-bold text-gray-900">Confirm Details</h2>
                {imageDataUrl && (
                  <button
                    onClick={retakePhoto}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    New Photo
                  </button>
                )}
              </div>

              {!parsed.amount && !parsed.merchant && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                  We couldn&apos;t auto-detect receipt details. Please fill in manually.
                </p>
              )}

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
      </main>
    </div>
  );
}

// ---- Receipt Parsing Utilities ----

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse OCR text from a receipt to extract amount, merchant, and date.
 * Uses common receipt patterns.
 */
function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // --- Amount parsing ---
  // Look for lines with "TOTAL", "AMOUNT", "BALANCE", "GRAND TOTAL"
  // or the last dollar amount on the receipt
  let amount: string | null = null;

  const totalPatterns = [
    /(?:grand\s+total|total\s+due|total\s+amount|total|amount\s+due|balance\s+due|sum)\s*:?\s*\$?\s*(\d+\.\d{2})/i,
    /\$\s*(\d+\.\d{2})\s*(?:total|due|balance)/i,
  ];

  for (const pattern of totalPatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        amount = match[1];
        break;
      }
    }
    if (amount) break;
  }

  // Fallback: find the largest dollar amount in the text (often the total)
  if (!amount) {
    const allAmounts: number[] = [];
    const amountRegex = /\$\s*(\d+\.\d{2})/g;
    let match: RegExpExecArray | null;
    while ((match = amountRegex.exec(text)) !== null) {
      allAmounts.push(parseFloat(match[1]));
    }
    // Also try bare decimal numbers
    const bareAmountRegex = /\b(\d+\.\d{2})\b/g;
    while ((match = bareAmountRegex.exec(text)) !== null) {
      allAmounts.push(parseFloat(match[1]));
    }
    if (allAmounts.length > 0) {
      // Pick the largest amount as the total (common for receipts)
      const largest = Math.max(...allAmounts);
      amount = largest.toFixed(2);
    }
  }

  // --- Merchant parsing ---
  // Usually the first non-empty line, or the line before the first item
  let merchant: string | null = null;
  if (lines.length > 0) {
    // Skip common header noise
    const skipPatterns = /^(receipt|invoice|order|date|store|phone|address|www\.|http)/i;
    const firstMeaningful = lines.find(
      (l) => l.length > 2 && !skipPatterns.test(l) && !/^\d+$/.test(l) && l.length < 40,
    );
    if (firstMeaningful) {
      // Clean up — remove trailing numbers/special chars
      merchant = firstMeaningful.replace(/[#*]+/g, '').trim();
    }
  }

  // --- Date parsing ---
  // Look for common date formats
  let date: string | null = null;
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(\w{3})\s+(\d{1,2}),?\s+(\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        date = normalizeDate(match[0]);
        break;
      }
    }
    if (date) break;
  }

  return { amount, merchant, date };
}

function normalizeDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return formatDateForInput(parsed);
  }
  // Try MM/DD/YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    let [, mm, dd, yy] = slashMatch;
    if (yy.length === 2) yy = '20' + yy;
    const d = new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd));
    if (!isNaN(d.getTime())) return formatDateForInput(d);
  }
  return formatDateForInput(new Date());
}

export default function ScanPage() {
  return (
    <AppProviders>
      <ScanPageInner />
    </AppProviders>
  );
}
