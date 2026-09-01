/**
 * Hijri-only DOB picker. The visible control uses Umm al-Qura day/month/year
 * values, while Form.Item still receives the Gregorian ISO date expected by
 * the current customer API.
 */
'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Select, Space } from 'antd';
import type { SelectProps } from 'antd/es/select';
import { useAuthStore } from '@/store/authStore';
import {
  getHijriMonthLength,
  getHijriMonthName,
  hijriToGregorianIso,
  toHijriParts,
  type HijriParts,
} from '@/utils/hijri';

export interface HijriDatePickerProps {
  /** Forwarded so a Form.Item's <label htmlFor> resolves to the actual control. */
  id?: string;
  /** ISO date string, e.g. "1990-05-12". Gregorian value for the existing API. */
  value?: string | null;
  onChange?: (value?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  style?: CSSProperties;
  className?: string;
  size?: SelectProps['size'];
}

const MIN_HIJRI_BIRTH_YEAR = 1300;

function isoToHijriParts(value?: string | null): Partial<HijriParts> {
  if (!value) return {};
  return toHijriParts(new Date(`${value.slice(0, 10)}T12:00:00`)) ?? {};
}

function isComplete(parts: Partial<HijriParts>): parts is HijriParts {
  return Boolean(parts.year && parts.month && parts.day);
}

export default function HijriDatePicker({
  id,
  value,
  onChange,
  disabled,
  allowClear = true,
  style,
  className,
  size,
}: HijriDatePickerProps) {
  const language = useAuthStore((state) => state.language);
  const lang: 'ar' | 'en' = language === 'ar' ? 'ar' : 'en';
  const internallyChanging = useRef(false);
  const [draft, setDraft] = useState<Partial<HijriParts>>(() => isoToHijriParts(value));
  const currentHijriYear = toHijriParts(new Date())?.year ?? 1448;

  useEffect(() => {
    if (internallyChanging.current) {
      internallyChanging.current = false;
      return;
    }
    setDraft(isoToHijriParts(value));
  }, [value]);

  const labels = {
    day: lang === 'ar' ? 'اليوم' : 'Day',
    month: lang === 'ar' ? 'الشهر' : 'Month',
    year: lang === 'ar' ? 'السنة' : 'Year',
  };

  const yearOptions = useMemo(
    () =>
      Array.from({ length: currentHijriYear - MIN_HIJRI_BIRTH_YEAR + 1 }, (_, index) => {
        const year = currentHijriYear - index;
        return { value: year, label: String(year) };
      }),
    [currentHijriYear],
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return { value: month, label: getHijriMonthName(month, lang) };
      }),
    [lang],
  );

  const maxDay = draft.year && draft.month ? getHijriMonthLength(draft.year, draft.month) : 30;
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, index) => ({ value: index + 1, label: String(index + 1) })),
    [maxDay],
  );

  const applyDraft = (nextDraft: Partial<HijriParts>) => {
    const nextMaxDay =
      nextDraft.year && nextDraft.month ? getHijriMonthLength(nextDraft.year, nextDraft.month) : 30;
    const normalizedDraft =
      nextDraft.day && nextDraft.day > nextMaxDay ? { ...nextDraft, day: undefined } : nextDraft;

    internallyChanging.current = true;
    setDraft(normalizedDraft);

    if (!isComplete(normalizedDraft)) {
      onChange?.(undefined);
      return;
    }

    onChange?.(hijriToGregorianIso(normalizedDraft) ?? undefined);
  };

  const commonProps: Pick<SelectProps<number>, 'disabled' | 'allowClear' | 'size'> = {
    disabled,
    allowClear,
    size,
  };

  return (
    <Space.Compact block className={className} style={style ?? { width: '100%' }} direction="horizontal">
      <Select
        {...commonProps}
        id={id}
        value={draft.day}
        options={dayOptions}
        placeholder={labels.day}
        onChange={(day) => applyDraft({ ...draft, day })}
        style={{ width: '26%' }}
      />
      <Select
        {...commonProps}
        value={draft.month}
        options={monthOptions}
        placeholder={labels.month}
        onChange={(month) => applyDraft({ ...draft, month })}
        style={{ width: '40%' }}
      />
      <Select
        {...commonProps}
        value={draft.year}
        options={yearOptions}
        placeholder={labels.year}
        onChange={(year) => applyDraft({ ...draft, year })}
        style={{ width: '34%' }}
        showSearch
        optionFilterProp="label"
      />
    </Space.Compact>
  );
}
