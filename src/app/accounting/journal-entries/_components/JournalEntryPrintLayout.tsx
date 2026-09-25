'use client';

import { forwardRef } from 'react';
import type { JournalEntryPrintDto } from '@/types/journal-entry.types';
import { getStatusLabel, JE_STATUS } from '@/types/journal-entry.types';

export interface JournalEntryPrintLayoutProps {
  data: JournalEntryPrintDto;
  isAr: boolean;
}

/**
 * Printable journal entry layout — inline styles so html2canvas / window.print
 * capture the same look as the general-voucher print page.
 */
const JournalEntryPrintLayout = forwardRef<HTMLDivElement, JournalEntryPrintLayoutProps>(
  function JournalEntryPrintLayout({ data, isAr }, ref) {
    const t = (ar: string, en: string) => (isAr ? ar : en);
    const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');
    const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString() : '—');

    const cell: React.CSSProperties = {
      border: '1px solid #d9d9d9',
      padding: '8px 10px',
      fontSize: 13,
    };
    const labelCell: React.CSSProperties = {
      ...cell,
      background: '#fafafa',
      fontWeight: 600,
      width: '22%',
    };
    const th: React.CSSProperties = {
      ...cell,
      background: '#f0f5ff',
      fontWeight: 700,
      textAlign: 'center',
    };

    const statusText =
      data.statusLabel ||
      getStatusLabel(data.status ?? JE_STATUS.Draft, isAr);

    const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
      <tr>
        <td style={labelCell}>{label}</td>
        <td style={cell}>{value ?? '—'}</td>
      </tr>
    );

    return (
      <div
        ref={ref}
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          width: 794,
          padding: 32,
          background: '#fff',
          color: '#141414',
          fontFamily: 'Tahoma, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #1677ff',
            paddingBottom: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>
              {t('قيد يومية', 'Journal Entry')}
            </div>
          </div>
          <div style={{ textAlign: isAr ? 'left' : 'right', fontSize: 12, color: '#595959' }}>
            <div>
              {t('رقم القيد', 'Journal Number')}:{' '}
              <strong style={{ color: '#141414' }}>{data.entryNumber || '—'}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              {t('التاريخ', 'Date')}:{' '}
              <strong style={{ color: '#141414' }}>{fmtDate(data.date)}</strong>
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <tbody>
            <Row label={t('الوصف', 'Description')} value={data.description || '—'} />
            <Row label={t('الحالة', 'Status')} value={statusText} />
            <Row label={t('أنشئ بواسطة', 'Created By')} value={data.createdBy || '—'} />
            <Row label={t('تاريخ الإنشاء', 'Creation Date')} value={fmtDateTime(data.createdDate)} />
            <Row label={t('اعتمد بواسطة', 'Approved By')} value={data.approvedBy || '—'} />
            <Row label={t('تاريخ الاعتماد', 'Approval Date')} value={fmtDateTime(data.approvalDate)} />
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('م', '#')}</th>
              <th style={th}>{t('رقم الحساب', 'Account Number')}</th>
              <th style={th}>{t('اسم الحساب', 'Account Name')}</th>
              <th style={th}>{t('مدين', 'Debit')}</th>
              <th style={th}>{t('دائن', 'Credit')}</th>
            </tr>
          </thead>
          <tbody>
            {(data.lines ?? []).map((line, idx) => (
              <tr key={idx}>
                <td style={{ ...cell, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ ...cell, fontFamily: 'monospace' }}>{line.accountNumber || '—'}</td>
                <td style={cell}>{line.accountName || '—'}</td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  {line.debit ? fmtMoney(line.debit) : '—'}
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>
                  {line.credit ? fmtMoney(line.credit) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={3}>
                {t('الإجمالي', 'Total')}
              </td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>
                {fmtMoney(data.totalDebit)}
              </td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>
                {fmtMoney(data.totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }
);

export default JournalEntryPrintLayout;
