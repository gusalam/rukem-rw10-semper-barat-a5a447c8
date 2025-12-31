import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'iuran' | 'pembayaran_iuran' | 'kas' | 'kematian' | 'santunan' | 'anggota' | 'notifikasi' | 'iuran_tagihan' | 'iuran_pembayaran' | 'penagih_wilayah';

interface UseRealtimeOptions {
  table: TableName;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: any) => void;
}

export function useRealtime({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channelName = `realtime-${table}-${Date.now()}`;
    
    const channel = supabase.channel(channelName);
    
    const config: any = {
      event,
      schema: 'public',
      table,
    };
    
    if (filter) {
      config.filter = filter;
    }

    channel.on('postgres_changes', config, (payload) => {
      console.log(`[Realtime] ${table}:`, payload);
      
      onChange?.(payload);
      
      if (payload.eventType === 'INSERT') {
        onInsert?.(payload);
      } else if (payload.eventType === 'UPDATE') {
        onUpdate?.(payload);
      } else if (payload.eventType === 'DELETE') {
        onDelete?.(payload);
      }
    });

    channel.subscribe((status) => {
      console.log(`[Realtime] ${table} subscription status:`, status);
    });

    channelRef.current = channel;

    return () => {
      console.log(`[Realtime] Unsubscribing from ${table}`);
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, onInsert, onUpdate, onDelete, onChange]);

  return channelRef.current;
}

// Hook for multiple table subscriptions
export function useMultiRealtime(
  tables: TableName[],
  onAnyChange: () => void
) {
  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    tables.forEach((table) => {
      const channel = supabase.channel(`multi-realtime-${table}-${Date.now()}`);
      
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
      }, () => {
        console.log(`[Realtime] Change detected in ${table}`);
        onAnyChange();
      });

      channel.subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables.join(','), onAnyChange]);
}
