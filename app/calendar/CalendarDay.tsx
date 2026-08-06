'use client';

import { memo } from 'react';
import { isSameDay, isToday } from 'date-fns';
import type { DayBalance } from '@/lib/types';
import { formatCurrencyCompact } from '@/lib/calculations';

interface CalendarDayProps {
  dayBalance: DayBalance;
  isCurrentMonth: boolean;
  onClick: () => void;
  isSelected: boolean;
}

function CalendarDayBase({ dayBalance, isCurrentMonth, onClick, isSelected }: CalendarDayProps) {
  const { date, balance, items, isLowBalance, isBelowZero } = dayBalance;
  const today = isToday(date);

  // Determine styling
  const balanceColor = isBelowZero
    ? 'text-red-600'
    : isLowBalance
      ? 'text-amber-600'
      : 'text-green-700';

  const cellBg = isSelected
    ? 'bg-blue-50 ring-2 ring-blue-400'
    : today
      ? 'bg-blue-50/50'
      : 'bg-white hover:bg-gray-50';

  const dayNumColor = isCurrentMonth ? 'text-gray-900' : 'text-gray-300';

  // Income/expense indicators
  const hasIncome = items.some((i) => i.type === 'income');
  const hasExpense = items.some((i) => i.type === 'expense');

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-stretch min-h-[72px] sm:min-h-[96px]
        border border-gray-200 p-1 sm:p-1.5
        transition-colors text-left
        ${cellBg}
        ${!isCurrentMonth ? 'opacity-50' : ''}
      `}
    >
      {/* Day number */}
      <div className="flex items-center justify-between">
        <span className={`text-xs sm:text-sm font-medium ${dayNumColor}`}>
          {date.getDate()}
        </span>
        {today && (
          <span className="hidden sm:inline text-[10px] font-bold text-blue-600 uppercase tracking-wide">
            Today
          </span>
        )}
      </div>

      {/* Balance */}
      <div className={`text-[10px] sm:text-xs font-semibold mt-0.5 ${balanceColor}`}>
        {formatCurrencyCompact(balance)}
      </div>

      {/* Item indicators */}
      <div className="flex gap-1 mt-auto">
        {hasIncome && (
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500" />
        )}
        {hasExpense && (
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />
        )}
        {items.length > 0 && (
          <span className="text-[9px] sm:text-[10px] text-gray-400 ml-0.5">
            {items.length}
          </span>
        )}
      </div>

      {/* Warning indicators */}
      {isBelowZero && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[16px] border-l-transparent border-t-[16px] border-t-red-500" />
      )}
      {isLowBalance && !isBelowZero && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[16px] border-l-transparent border-t-[16px] border-t-amber-400" />
      )}
    </button>
  );
}

export const CalendarDay = memo(CalendarDayBase);
