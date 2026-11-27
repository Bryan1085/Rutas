import React from 'react';
import { Award, Check } from 'lucide-react';
import { DeliveryItem } from '../types';
import {
  MILESTONE_TIERS,
  getInlineMotivationalStatus,
} from '../utils/motivationalRewards';

interface MotivationalProgressBarProps {
  items: DeliveryItem[];
}

export const MotivationalProgressBar: React.FC<MotivationalProgressBarProps> = ({ items }) => {
  const totalCount = items.length;
  const deliveredCount = items.filter(i => i.status === 'delivered').length;
  const percentage = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;
  const statusLine = getInlineMotivationalStatus(percentage, totalCount, deliveredCount);
  const isComplete = totalCount > 0 && percentage === 100;

  return (
    <section
      aria-label="Progreso motivacional de entregas"
      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isComplete
                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
                : percentage >= 25
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
            <h2 className="text-xs font-extrabold text-gray-900 dark:text-slate-100 shrink-0">
              Meta
            </h2>
            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 tabular-nums shrink-0">
              {deliveredCount}/{totalCount}
            </span>
            <p className="text-[11px] text-gray-600 dark:text-slate-300 truncate">
              · {statusLine}
            </p>
          </div>
        </div>

        <span
          className={`text-sm sm:text-base font-black tabular-nums tracking-tight shrink-0 ${
            isComplete
              ? 'text-amber-600 dark:text-amber-400'
              : percentage >= 25
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-700 dark:text-slate-200'
          }`}
        >
          {percentage}%
        </span>
      </div>

      {/* Slim Progress Bar Track */}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso de entregas: ${percentage}%`}
        className="relative h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden"
      >
        <div
          style={{ width: `${percentage}%` }}
          className={`h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400'
              : 'bg-gradient-to-r from-emerald-600 to-teal-500'
          }`}
        />

        {/* Milestone Divider Ticks at 25%, 50%, 75% */}
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-1/4 w-px bg-white/75 dark:bg-slate-900/75"
        />
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-2/4 w-px bg-white/75 dark:bg-slate-900/75"
        />
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-3/4 w-px bg-white/75 dark:bg-slate-900/75"
        />
      </div>

      {/* Compact Milestone Steps Row */}
      <div className="grid grid-cols-4 mt-1 text-[10px] leading-none font-bold tabular-nums">
        {MILESTONE_TIERS.map(tier => {
          const reached = totalCount > 0 && percentage >= tier;
          return (
            <div
              key={tier}
              className={`flex items-center justify-end gap-0.5 pr-0.5 transition-colors ${
                reached
                  ? tier === 100
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            >
              {reached && <Check className="w-2.5 h-2.5 shrink-0" strokeWidth={3} />}
              <span>{tier}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
