import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NotificationSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { StandardMessages } from '@/lib/error-messages';
import { formatDate } from '@/lib/format';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import type { Notifikasi } from '@/types/database';

export default function NotifikasiPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifikasi();
    }
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifikasi-page-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifikasi',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notifikasi;
          setNotifikasi(prev => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifikasi = async () => {
    try {
      const { data, error } = await supabase
        .from('notifikasi')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifikasi(data as Notifikasi[] || []);
    } catch (error) {
      console.error('Error fetching notifikasi:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId: string) => {
    await supabase.from('notifikasi').update({ dibaca: true }).eq('id', notifId);
    setNotifikasi(prev => prev.map(n => n.id === notifId ? { ...n, dibaca: true } : n));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifikasi.filter(n => !n.dibaca).map(n => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from('notifikasi')
      .update({ dibaca: true })
      .in('id', unreadIds);

    setNotifikasi(prev => prev.map(n => ({ ...n, dibaca: true })));
    
    toast({
      title: '✓ Berhasil',
      description: StandardMessages.success.notifikasi.readAll,
    });
  };

  const unreadCount = notifikasi.filter(n => !n.dibaca).length;

  if (loading) {
    return (
      <AnggotaLayout>
        <PageHeader title="Notifikasi" description="Memuat notifikasi..." />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))}
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader 
          title="Notifikasi"
          description={`${unreadCount} notifikasi belum dibaca`}
        />
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Tandai Semua Dibaca
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {notifikasi.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={Bell}
                title="Belum ada notifikasi"
                description="Notifikasi akan muncul di sini ketika ada informasi penting"
              />
            </CardContent>
          </Card>
        ) : (
          notifikasi.map((notif) => (
            <Card
              key={notif.id}
              className={`transition-colors ${
                !notif.dibaca 
                  ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' 
                  : 'hover:bg-accent/50'
              }`}
            >
              <CardContent className="p-4">
                <div 
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => !notif.dibaca && markAsRead(notif.id)}
                >
                  <div className={`mt-1 flex-shrink-0 ${!notif.dibaca ? 'text-primary' : 'text-muted-foreground'}`}>
                    {!notif.dibaca ? (
                      <Circle className="h-3 w-3 fill-current" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-semibold text-sm ${!notif.dibaca ? 'text-primary' : ''}`}>
                        {notif.judul}
                      </h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {notif.pesan}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AnggotaLayout>
  );
}
