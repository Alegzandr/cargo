'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Clock, Download, Link2, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from './Countdown';
import { EditRecipientDialog } from './EditRecipientDialog';
import { PurgeAllDialog } from './PurgeAllDialog';
import { RevokeDialog } from './RevokeDialog';
import { ShareLinkDialog } from './ShareLinkDialog';
import { useTransferPoll } from './useTransferPoll';
import { formatBytes, truncateMiddle } from '@/lib/utils';
import type { Direction, TransferRow } from './transferTypes';

export type { Direction, TransferRow } from './transferTypes';

export function TransferTable({ direction }: { direction: Direction }): JSX.Element {
  const t = useTranslations(direction);
  const locale = useLocale();
  const { rows, reload } = useTransferPoll(direction);
  const [revoking, setRevoking] = useState<TransferRow | null>(null);
  const [editing, setEditing] = useState<TransferRow | null>(null);
  const [sharing, setSharing] = useState<TransferRow | null>(null);
  const [purgeAllOpen, setPurgeAllOpen] = useState(false);

  if (rows === null) return <div />;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-hairline py-16 px-8 text-center">
        <p className="text-[13px] text-muted">{t('empty')}</p>
      </div>
    );
  }

  return (
    <>
      {direction === 'outbox' && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted hover:text-danger"
            onClick={() => setPurgeAllOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> {t('purgeAll')}
          </Button>
        </div>
      )}
      <div className="rounded-md border border-hairline overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface">
            <tr className="text-left">
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t('colFilename')}
              </th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {direction === 'outbox' ? t('colRecipient') : t('colSender')}
              </th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted text-right">
                {t('colSize')}
              </th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t('colExpires')}
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline hover:bg-elevated">
                <td className="px-4 py-3 mono text-[13px] text-ink truncate max-w-[28rem]" title={r.filename}>
                  <span className="inline-flex items-center gap-1.5">
                    {direction === 'outbox' && (
                      r.status === 'pending' ? (
                        <span title={t('pending')} aria-label={t('pending')}>
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted" />
                        </span>
                      ) : (
                        <span
                          title={r.first_downloaded_at ? t('delivered') : t('notDelivered')}
                          aria-label={r.first_downloaded_at ? t('delivered') : t('notDelivered')}
                        >
                          <CheckCircle2
                            className={`h-3.5 w-3.5 shrink-0 ${r.first_downloaded_at ? 'text-success' : 'text-subtle/40'}`}
                          />
                        </span>
                      )
                    )}
                    <span className="truncate">{truncateMiddle(r.filename, 64)}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {r.peer ? (
                      <span className="mono text-[12px] text-muted">@{r.peer.username}</span>
                    ) : (
                      <span className="text-[12px] text-subtle">—</span>
                    )}
                    {direction === 'outbox' && r.peer && (
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="text-subtle hover:text-ink"
                        aria-label={t('editRecipient')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 mono text-[13px] text-ink text-right">
                  {formatBytes(r.size_bytes, locale)}
                </td>
                <td className="px-4 py-3">
                  {r.expires_at ? (
                    <Countdown expiresAt={r.expires_at} />
                  ) : r.pending_expires_at ? (
                    <Countdown expiresAt={r.pending_expires_at} />
                  ) : (
                    <span className="text-[12px] text-subtle">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {direction === 'inbox' ? (
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/api/transfers/${r.id}/download`}>
                        <Download className="h-3.5 w-3.5" /> {t('download')}
                      </a>
                    </Button>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {(r.status === 'ready' || r.status === 'pending') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSharing(r)}
                          aria-label={t('shareLink')}
                        >
                          <Link2 className="h-3.5 w-3.5" /> {t('shareLink')}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRevoking(r)}
                        className="text-muted hover:text-danger"
                        aria-label={t('revoke')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditRecipientDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <PurgeAllDialog
        open={purgeAllOpen}
        count={rows.length}
        onClose={() => setPurgeAllOpen(false)}
        onPurged={reload}
      />
      <ShareLinkDialog target={sharing} onClose={() => setSharing(null)} />
      <RevokeDialog
        target={revoking}
        onClose={() => setRevoking(null)}
        onRevoked={reload}
      />
    </>
  );
}
