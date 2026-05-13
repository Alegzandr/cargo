export interface TransferRow {
  id: string;
  filename: string;
  size_bytes: number;
  status: 'uploading' | 'pending' | 'ready';
  created_at: string;
  expires_at: string | null;
  pending_expires_at: string | null;
  delivered_at: string | null;
  first_downloaded_at: string | null;
  peer: { username: string; global_name: string | null; avatar_url: string | null } | null;
}

export type Direction = 'outbox' | 'inbox';
