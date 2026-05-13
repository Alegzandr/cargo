'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type * as tus from 'tus-js-client';
import { RecipientPicker, isValidHandle, normalizeHandle } from './RecipientPicker';
import { Dropzone } from './Dropzone';
import { HeroProgressCard, type UploadState } from './HeroProgressCard';
import { LinkCard } from './LinkCard';

interface FinishedTransfer {
  share_url: string | null;
  expires_at: string | null;
  pending_expires_at: string | null;
  recipient_username: string;
}

export function SendForm(): JSX.Element {
  const t = useTranslations('send');
  const [recipient, setRecipient] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [bytesPerSec, setBytesPerSec] = useState(0);
  const [state, setState] = useState<UploadState>('queued');
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState<FinishedTransfer | null>(null);
  const uploadRef = useRef<tus.Upload | null>(null);
  const lastSampleRef = useRef<{ t: number; bytes: number }>({ t: 0, bytes: 0 });

  const handle = normalizeHandle(recipient);
  const handleOk = isValidHandle(recipient);

  async function startUpload(f: File): Promise<void> {
    setFile(f);
    setState('encrypting');
    setLoaded(0);
    lastSampleRef.current = { t: Date.now(), bytes: 0 };

    // Lazy-load tus-js-client only on the Send flow; ~70KB gz that the Inbox,
    // Outbox, and download pages otherwise pay for and never use.
    const tusMod = await import('tus-js-client');
    const upload = new tusMod.Upload(f, {
      endpoint: '/api/tus',
      retryDelays: [0, 1000, 3000, 5000, 10000],
      // Cloudflare's request-body cap is 100 MB (Free) / 200 MB (Pro). Each
      // PATCH must fit comfortably under that — too large and the edge truncates
      // the request, the server's pipeline() throws, and the store wipes the
      // upload state (forcing the client to restart from zero).
      chunkSize: 64 * 1024 * 1024,
      metadata: {
        filename: f.name,
        recipient_username: handle,
      },
      onError() {
        setState('failed');
      },
      onProgress(uploaded, total) {
        setLoaded(uploaded);
        const now = Date.now();
        const dt = (now - lastSampleRef.current.t) / 1000;
        const db = uploaded - lastSampleRef.current.bytes;
        if (dt >= 0.5) {
          setBytesPerSec(db / dt);
          lastSampleRef.current = { t: now, bytes: uploaded };
        }
        if (uploaded >= total) setState('finalizing');
      },
      onAfterResponse(_req, res) {
        // The tus finalize hook always sets Cargo-Status; expires_at is
        // omitted for pending transfers (no claim yet, so no 1h window).
        const status = res.getHeader('Cargo-Status');
        if (status !== 'ready' && status !== 'pending') return;
        const url = res.getHeader('Cargo-Share-Url');
        const expires = res.getHeader('Cargo-Expires-At');
        const pendingExpires = res.getHeader('Cargo-Pending-Expires-At');
        if (!url) return;
        const absolute = url.startsWith('http') ? url : window.location.origin + url;
        setDone({
          share_url: absolute,
          expires_at: expires ?? null,
          pending_expires_at: pendingExpires ?? null,
          recipient_username: handle,
        });
        setState('ready');
      },
    });

    uploadRef.current = upload;
    upload.start();
  }

  function onFile(f: File): void {
    if (!handleOk) return;
    void startUpload(f);
  }

  function pause(): void {
    uploadRef.current?.abort();
    setPaused(true);
  }
  function resume(): void {
    setPaused(false);
    uploadRef.current?.start();
  }
  function cancel(): void {
    void uploadRef.current?.abort(true);
    uploadRef.current = null;
    setFile(null);
    setState('queued');
    setLoaded(0);
    setBytesPerSec(0);
    setPaused(false);
  }

  if (done) {
    return (
      <LinkCard
        shareUrl={done.share_url}
        expiresAt={done.expires_at}
        pendingExpiresAt={done.pending_expires_at}
        recipientUsername={done.recipient_username}
      />
    );
  }

  if (file) {
    return (
      <HeroProgressCard
        filename={file.name}
        loaded={loaded}
        total={file.size}
        bytesPerSec={bytesPerSec}
        state={state}
        paused={paused}
        onPause={pause}
        onResume={resume}
        onCancel={cancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <RecipientPicker value={recipient} onChange={setRecipient} />
      <p className="text-[13px] text-muted">
        {t('privacy')}{' '}
        <Link
          href="/privacy"
          className="text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent"
        >
          {t('privacyLink')}
        </Link>
      </p>
      <Dropzone onFile={onFile} disabled={!handleOk} />
    </div>
  );
}
