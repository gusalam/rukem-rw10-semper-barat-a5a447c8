import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NetworkStatus } from '@/components/ui/network-status';
import {
  Heart,
  LayoutDashboard,
  Receipt,
  History,
  User,
  LogOut,
  Bell,
  ArrowLeft,
  Users,
  HandHeart,
} from 'lucide-react';

const anggotaMenuItems = [
  { icon: LayoutDashboard, label: 'Beranda', path: '/anggota' },
  { icon: Receipt, label: 'Iuran', path: '/anggota/iuran' },
  { icon: History, label: 'Riwayat', path: '/anggota/riwayat' },
  { icon: Users, label: 'Keluarga', path: '/anggota/keluarga' },
  { icon: User, label: 'Profil', path: '/anggota/profil' },
];

interface AnggotaLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  title?: string;
}

export function AnggotaLayout({ children, showBackButton = true, title }: AnggotaLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { anggota, user, signOut } = useAuth();

  const isDashboard = location.pathname === '/anggota';

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  // Real-time subscription for notification count updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('anggota-notifikasi-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifikasi',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;
    
    const { count, error } = await supabase
      .from('notifikasi')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('dibaca', false);

    if (!error && count !== null) {
      setUnreadCount(count);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/auth');
    } finally {
      setLoggingOut(false);
      setLogoutDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NetworkStatus />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {showBackButton && !isDashboard && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/anggota')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {isDashboard ? (
              <>
                <div className="p-2 rounded-full bg-primary/10">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">RUKEM</h1>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {anggota?.nama_lengkap || 'Anggota'}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <h1 className="font-bold text-lg">{title || getPageTitle(location.pathname)}</h1>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {anggota?.nama_lengkap || 'Anggota'}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/anggota/notifikasi" className="relative">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setLogoutDialogOpen(true)}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-65px)] pb-20 lg:pb-8">
        <div className="p-4 max-w-4xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t lg:hidden z-50">
        <div className="grid grid-cols-5 gap-1 p-2">
          {anggotaMenuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/anggota' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors relative',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] mt-1 truncate text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Bottom Menu Bar */}
      <nav className="hidden lg:block fixed bottom-0 left-0 right-0 bg-background border-t z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 p-3">
          {anggotaMenuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/anggota' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors relative',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/anggota': 'Beranda',
    '/anggota/notifikasi': 'Notifikasi',
    '/anggota/iuran': 'Iuran Saya',
    '/anggota/riwayat': 'Riwayat Pembayaran',
    '/anggota/keluarga': 'Data Keluarga',
    '/anggota/santunan': 'Info Santunan',
    '/anggota/profil': 'Profil',
  };
  
  return titles[pathname] || 'RUKEM';
}
