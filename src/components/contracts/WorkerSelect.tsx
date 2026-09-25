/**
 * Searchable worker picker for operation contracts.
 *
 * Loads workers that the backend considers available for contract assignment
 * (`availableForMediationContract=true` — active and not busy on mediation /
 * operating / transfer). When editing an existing contract, the currently
 * selected worker is still shown even if they are now busy on this contract.
 *
 * Designed to be placed inside an Ant <Form> via <Form.Item name="workerId">.
 * It reads the surrounding form instance to auto-fill the sibling fields.
 */
'use client';

import React, { useMemo } from 'react';
import { Select, Form, Spin } from 'antd';
import { useAvailableWorkers, useWorker } from '@/hooks/api/useWorkers';
import type { Worker } from '@/types/api.types';

interface Props {
  /** Bound by Form.Item — current workerId (UUID). */
  value?: string;
  /** Bound by Form.Item. */
  onChange?: (value: string | undefined) => void;
  isRtl: boolean;
  /** Form field names to auto-fill from the selected worker. */
  nameArField?: string;
  nameEnField?: string;
  phoneField?: string;
  disabled?: boolean;
}

const workerLabel = (w: Worker, isRtl: boolean): string => {
  const name = isRtl
    ? w.fullNameAr || w.fullNameEn || `#${w.id}`
    : w.fullNameEn || w.fullNameAr || `#${w.id}`;
  return w.passportNo ? `${name} — ${w.passportNo}` : String(name);
};

export default function WorkerSelect({
  value,
  onChange,
  isRtl,
  nameArField = 'workerNameAr',
  nameEnField = 'workerNameEn',
  phoneField = 'workerPhone',
  disabled,
}: Props) {
  const form = Form.useFormInstance();
  const { data: availableWorkers = [], isLoading: loadingAvailable } = useAvailableWorkers();
  const { data: selectedWorker, isLoading: loadingSelected } = useWorker(
    value && !availableWorkers.some((w) => String(w.id) === String(value)) ? value : undefined
  );

  const workers = useMemo(() => {
    const list = [...(availableWorkers as Worker[])];
    if (
      selectedWorker &&
      !list.some((w) => String(w.id) === String(selectedWorker.id))
    ) {
      list.unshift(selectedWorker);
    }
    return list;
  }, [availableWorkers, selectedWorker]);

  const isLoading = loadingAvailable || loadingSelected;

  const options = useMemo(
    () =>
      workers.map((w) => ({
        value: String(w.id),
        label: workerLabel(w, isRtl),
        search: [w.fullNameAr, w.fullNameEn, w.passportNo, w.mobile]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      })),
    [workers, isRtl]
  );

  const handleChange = (next: string | undefined) => {
    onChange?.(next);
    const worker = workers.find((w) => String(w.id) === next);
    if (worker) {
      form?.setFieldsValue({
        [nameArField]: worker.fullNameAr ?? undefined,
        [nameEnField]: worker.fullNameEn ?? undefined,
        [phoneField]: worker.mobile ?? worker.phone ?? undefined,
      });
    } else {
      form?.setFieldsValue({
        [nameArField]: undefined,
        [nameEnField]: undefined,
        [phoneField]: undefined,
      });
    }
  };

  return (
    <Select
      showSearch
      allowClear
      disabled={disabled}
      loading={isLoading}
      value={value}
      onChange={handleChange}
      placeholder={isRtl ? 'ابحث عن عامل متاح (الاسم أو رقم الجواز)' : 'Search available worker (name or passport)'}
      notFoundContent={
        isLoading ? (
          <Spin size="small" />
        ) : isRtl ? (
          'لا يوجد عامل متاح'
        ) : (
          'No available workers'
        )
      }
      filterOption={(input, option) =>
        ((option as any)?.search ?? '').includes(input.toLowerCase())
      }
      options={options}
      style={{ width: '100%' }}
    />
  );
}
