import { Task, PhaseId, ReminderSettings } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export interface CadenceContext {
  startDate: string;
  timezone: string;
  phaseStartDates: Partial<Record<PhaseId, string>>;
  reminderSettings: Pick<ReminderSettings, 'weeklyDay' | 'monthlyDay'>;
  activePhase: PhaseId;
}

export interface TaskSchedule {
  dueDateKey: string | null;
  status: 'overdue' | 'due' | 'upcoming' | 'completed';
  isCompletedForPeriod: boolean;
  daysUntilDue: number | null;
}

export const getDefaultTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const isDateKey = (value?: string | null) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(value => Number(value));
  return { year, month, day };
};

const dateKeyToUtcDate = (key: string) => {
  const { year, month, day } = parseDateKey(key);
  // Use UTC noon to avoid DST edges when converting across time zones.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

export const getZonedDateKey = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value ?? '0000';
  const month = parts.find(part => part.type === 'month')?.value ?? '01';
  const day = parts.find(part => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
};

export const normalizeDateKey = (value: string, timeZone: string) =>
  isDateKey(value) ? value : getZonedDateKey(new Date(value), timeZone);

export const formatZonedTimestamp = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value ?? '0000';
  const month = parts.find(part => part.type === 'month')?.value ?? '01';
  const day = parts.find(part => part.type === 'day')?.value ?? '01';
  const hour = parts.find(part => part.type === 'hour')?.value ?? '00';
  const minute = parts.find(part => part.type === 'minute')?.value ?? '00';
  const second = parts.find(part => part.type === 'second')?.value ?? '00';
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

export const getDateKeyFromTimestamp = (timestamp: string | undefined, timeZone: string) => {
  if (!timestamp) return null;
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const hasOffset = /[zZ]|[+-]\d{2}:\d{2}$/.test(timestamp);
  if (!hasOffset) {
    return match[1];
  }
  return getZonedDateKey(new Date(timestamp), timeZone);
};

const compareDateKeys = (a: string, b: string) => {
  const diff = dateKeyToUtcDate(a).getTime() - dateKeyToUtcDate(b).getTime();
  return diff === 0 ? 0 : diff > 0 ? 1 : -1;
};

const addDaysToKey = (key: string, days: number, timeZone: string) => {
  const date = dateKeyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return getZonedDateKey(date, timeZone);
};

const daysBetweenKeys = (fromKey: string, toKey: string) => {
  const fromDate = dateKeyToUtcDate(fromKey);
  const toDate = dateKeyToUtcDate(toKey);
  return Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS);
};

const getWeekdayIndex = (key: string, timeZone: string) => {
  const date = dateKeyToUtcDate(key);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
  const weekday = formatter.format(date);
  return WEEKDAY_INDEX[weekday] ?? 0;
};

const getDaysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const getNextWeeklyKey = (baseKey: string, weekday: number, includeBase: boolean, timeZone: string) => {
  const baseWeekday = getWeekdayIndex(baseKey, timeZone);
  let delta = (weekday - baseWeekday + 7) % 7;
  if (!includeBase && delta === 0) {
    delta = 7;
  }
  return addDaysToKey(baseKey, delta, timeZone);
};

const getMonthlyScheduledKey = (year: number, month: number, dayOfMonth: number) => {
  const clampedDay = Math.min(Math.max(dayOfMonth, 1), getDaysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
};

const getNextMonthlyKey = (baseKey: string, dayOfMonth: number, includeBase: boolean) => {
  const { year, month } = parseDateKey(baseKey);
  const scheduledKey = getMonthlyScheduledKey(year, month, dayOfMonth);
  if (includeBase) {
    if (compareDateKeys(scheduledKey, baseKey) >= 0) {
      return scheduledKey;
    }
  } else {
    if (compareDateKeys(scheduledKey, baseKey) > 0) {
      return scheduledKey;
    }
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return getMonthlyScheduledKey(nextYear, nextMonth, dayOfMonth);
};

const resolveStartKey = (startDate: string, timeZone: string) =>
  isDateKey(startDate) ? startDate : getZonedDateKey(new Date(startDate), timeZone);

const getTaskAnchorKey = (task: Task, context: CadenceContext) => {
  const startKey = resolveStartKey(context.startDate, context.timezone);
  if (task.startPhaseId && context.phaseStartDates?.[task.startPhaseId]) {
    return context.phaseStartDates[task.startPhaseId] as string;
  }
  return startKey;
};

const getPhaseStartKey = (task: Task, context: CadenceContext) => {
  const startKey = resolveStartKey(context.startDate, context.timezone);
  const phaseId = task.phaseId ?? context.activePhase;
  if (phaseId && context.phaseStartDates?.[phaseId]) {
    return context.phaseStartDates[phaseId] as string;
  }
  return startKey;
};

export const getTaskSchedule = (
  task: Task,
  context: CadenceContext,
  now = new Date()
): TaskSchedule => {
  const todayKey = getZonedDateKey(now, context.timezone);
  const startKey = getTaskAnchorKey(task, context);
  const completionKey =
    getDateKeyFromTimestamp(task.lastCompletedAt, context.timezone) ||
    (task.completed ? startKey : null);
  const effectiveCompletionKey =
    completionKey && compareDateKeys(completionKey, startKey) >= 0 ? completionKey : null;

  if (task.frequency === 'one-time') {
    const dueDateKey = getPhaseStartKey(task, context);
    const isCompletedForPeriod = Boolean(task.completed || effectiveCompletionKey);
    const daysUntilDue = dueDateKey ? daysBetweenKeys(todayKey, dueDateKey) : null;
    const status = isCompletedForPeriod
      ? 'completed'
      : daysUntilDue !== null && daysUntilDue < 0
        ? 'overdue'
        : daysUntilDue === 0
          ? 'due'
          : 'upcoming';
    return { dueDateKey, status, isCompletedForPeriod, daysUntilDue };
  }

  let dueDateKey = startKey;
  let isCompletedForPeriod = false;

  switch (task.frequency) {
    case 'daily': {
      if (effectiveCompletionKey && effectiveCompletionKey === todayKey) {
        isCompletedForPeriod = true;
        dueDateKey = addDaysToKey(todayKey, 1, context.timezone);
      } else {
        dueDateKey = compareDateKeys(startKey, todayKey) > 0 ? startKey : todayKey;
      }
      break;
    }
    case 'interval': {
      const intervalDays = Math.max(1, Number(task.everyDays || 1));
      if (effectiveCompletionKey) {
        dueDateKey = addDaysToKey(effectiveCompletionKey, intervalDays, context.timezone);
        isCompletedForPeriod = compareDateKeys(todayKey, dueDateKey) < 0;
      } else {
        if (compareDateKeys(todayKey, startKey) >= 0) {
          const daysSinceStart = daysBetweenKeys(startKey, todayKey);
          const intervals = Math.floor(daysSinceStart / intervalDays);
          dueDateKey = addDaysToKey(startKey, intervals * intervalDays, context.timezone);
        } else {
          dueDateKey = startKey;
        }
      }
      break;
    }
    case 'weekly': {
      const weekday = context.reminderSettings.weeklyDay ?? 1;
      if (effectiveCompletionKey) {
        dueDateKey = getNextWeeklyKey(effectiveCompletionKey, weekday, false, context.timezone);
        isCompletedForPeriod = compareDateKeys(todayKey, dueDateKey) < 0;
      } else {
        const firstDueKey = getNextWeeklyKey(startKey, weekday, true, context.timezone);
        if (compareDateKeys(todayKey, firstDueKey) < 0) {
          dueDateKey = firstDueKey;
        } else {
          const daysSinceFirst = daysBetweenKeys(firstDueKey, todayKey);
          const weeksSince = Math.floor(daysSinceFirst / 7);
          dueDateKey = addDaysToKey(firstDueKey, weeksSince * 7, context.timezone);
        }
      }
      break;
    }
    case 'monthly': {
      const dayOfMonth = context.reminderSettings.monthlyDay ?? 1;
      if (effectiveCompletionKey) {
        dueDateKey = getNextMonthlyKey(effectiveCompletionKey, dayOfMonth, false);
        isCompletedForPeriod = compareDateKeys(todayKey, dueDateKey) < 0;
      } else {
        const firstDueKey = getNextMonthlyKey(startKey, dayOfMonth, true);
        if (compareDateKeys(todayKey, firstDueKey) < 0) {
          dueDateKey = firstDueKey;
        } else {
          const { year: todayYear, month: todayMonth } = parseDateKey(todayKey);
          const scheduledThisMonth = getMonthlyScheduledKey(todayYear, todayMonth, dayOfMonth);
          if (compareDateKeys(scheduledThisMonth, todayKey) <= 0) {
            dueDateKey = compareDateKeys(scheduledThisMonth, firstDueKey) >= 0
              ? scheduledThisMonth
              : firstDueKey;
          } else {
            const prevMonth = todayMonth === 1 ? 12 : todayMonth - 1;
            const prevYear = todayMonth === 1 ? todayYear - 1 : todayYear;
            const scheduledPrevMonth = getMonthlyScheduledKey(prevYear, prevMonth, dayOfMonth);
            dueDateKey = compareDateKeys(scheduledPrevMonth, firstDueKey) >= 0
              ? scheduledPrevMonth
              : firstDueKey;
          }
        }
      }
      break;
    }
    default:
      break;
  }

  const daysUntilDue = dueDateKey ? daysBetweenKeys(todayKey, dueDateKey) : null;
  const status = isCompletedForPeriod
    ? 'completed'
    : daysUntilDue !== null && daysUntilDue < 0
      ? 'overdue'
      : daysUntilDue === 0
        ? 'due'
        : 'upcoming';
  return { dueDateKey, status, isCompletedForPeriod, daysUntilDue };
};

export const formatDateKeyForDisplay = (key: string, timeZone: string) => {
  const date = dateKeyToUtcDate(key);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric'
  });
  return formatter.format(date);
};
