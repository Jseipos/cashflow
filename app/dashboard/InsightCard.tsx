'use client';

import type { Insight, InsightTone } from './insights';

const TONE_STYLES: Record<InsightTone, { border: string; value: string }> = {
  good: { border: 'border-l-green-500', value: 'text-green-700' },
  warning: { border: 'border-l-amber-500', value: 'text-amber-700' },
  alert: { border: 'border-l-red-500', value: 'text-red-700' },
  info: { border: 'border-l-blue-500', value: 'text-blue-700' },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const tone = TONE_STYLES[insight.tone] ?? TONE_STYLES.info;

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${tone.border} p-4 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none flex-shrink-0">{insight.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900">{insight.title}</h4>
          <p className={`text-lg font-bold ${tone.value} mt-0.5`}>
            {insight.value}
          </p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  );
}
