'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  format,
} from 'date-fns';
import type { Account, ScheduledItem, DayBalance } from '@/lib/types';
import { projectBalances } from '@/lib/calculations';
import { CalendarDay } from './CalendarDay';

interface CalendarGridProps {
  account: Account;
  scheduledItems: ScheduledItem[];
  viewMonth: Date;
  selectedDate: Date | null;
  onSelectDay: (date: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarGrid({
  account,
  scheduledItems,
  viewMonth,
  selectedDate,
  onSelectDay,
}: CalendarGridProps) {
  // Calculate the full grid of days (includes padding from prev/next month)
  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  // We need to project balances starting from today through the end of the visible grid
  // (or 90 days, whichever is further). But to keep it simple, we project from today
  // for 90 days and map grid days to balances.
  const balanceMap = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Find the earliest day in the grid to start projections from
    const gridStart = gridDays[0];
    const projectionStart = isBeforeDay(gridStart, todayStart) ? gridStart : todayStart;

    // Project enough days to cover the grid + 90 days
    const projectionDays = Math.max(
      90,
      differenceInDaysSafe(gridDays[gridDays.length - 1], projectionStart) + 1,
    );

    const balances = projectBalances(account, scheduledItems, projectionStart, projectionDays);

    const map = new Map<string, DayBalance>();
    for (const b of balances) {
      map.set(b.date.toDateString(), b);
    }
    return map;
  }, [account, scheduledItems, gridDays]);

  return (
    <div className="w-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide py-1"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day[0]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0 rounded-lg overflow-hidden border border-gray-200">
        {gridDays.map((date) => {
          const key = date.toDateString();
          const dayBalance = balanceMap.get(key);

          // For days before today (no projection), show a muted state
          const isPast = isBeforeDay(date, new Date());

          if (!dayBalance) {
            // Day is before projection start — show empty
            return (
              <div
                key={key}
                className={`flex flex-col min-h-[72px] sm:min-h-[96px] border border-gray-200 bg-gray-50 p-1 sm:p-1.5 ${
                  !isSameMonth(date, viewMonth) ? 'opacity-40' : ''
                } ${isPast ? '' : ''}`}
              >
                <span className={`text-xs sm:text-sm ${isSameMonth(date, viewMonth) ? 'text-gray-400' : 'text-gray-300'}`}>
                  {date.getDate()}
                </span>
              </div>
            );
          }

          return (
            <CalendarDay
              key={key}
              dayBalance={dayBalance}
              isCurrentMonth={isSameMonth(date, viewMonth)}
              onClick={() => onSelectDay(date)}
              isSelected={selectedDate ? isSameDaySafe(selectedDate, date) : false}
            />
          );
        })}
      </div>
    </div>
  );
}

// Helper functions to avoid date-fns naming conflicts
function isBeforeDay(a: Date, b: Date): boolean {
  const aTime = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bTime = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return aTime < bTime;
}

function isSameDaySafe(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function differenceInDaysSafe(a: Date, b: Date): number {
  const aTime = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bTime = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aTime - bTime) / (1000 * 60 * 60 * 24));
}
