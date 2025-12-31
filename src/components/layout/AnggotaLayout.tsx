import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
  Menu,
  Bell,
  ChevronRight,
} from 'lucide-react';

const anggotaMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/anggota', showBadge: false },
  { icon: Bell, label: 'Notifikasi', href: '/anggota/notifikasi', showBadge: true },
  { icon: Receipt, label: 'Iuran Saya', href: '/anggota/iuran', showBadge: false },
  { icon: History, label: 'Riwayat', href: '/anggota/riwayat', showBadge: false },
  { icon: User, label: 'Profil', href: '/anggota/profil', showBadge: false },
];

interface AnggotaLayoutProps {
  children: React.ReactNode;
}

function SidebarContent({ 
  onNavigate, 
  unreadCount,
  onLogoutClick,
  anggotaName,
}: { 
  onNavigate?: () => void;
  unreadCount: number;
  onLogoutClick: () => void;
  anggotaName: string;
}) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Heart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-sm">RUKEM</h1>
          <p className="text-xs text-muted-foreground truncate max-w-[140px]">
            {anggotaName}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {anggotaMenuItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/anggota' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.showBadge && unreadCount > 0 && (
                  <Badge 
                    variant={isActive ? "secondary" : "destructive"} 
                    className="ml-auto h-5 min-w-[20px] px-1.5 text-xs"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
                {isActive && !item.showBadge && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={onLogoutClick}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Keluar
        </Button>
      </div>
    </div>
  );
}

export function AnggotaLayout({ children }: AnggotaLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { anggota, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  // Real-time subscription for notification count updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('sidebar-notifikasi-count')
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

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Network Status Banner */}
      <NetworkStatus />
      
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-card lg:block">
        <SidebarContent 
          unreadCount={unreadCount} 
          onLogoutClick={handleLogoutClick}
          anggotaName={anggota?.nama_lengkap || 'Anggota'}
        />
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card/95 backdrop-blur px-4 lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent 
              onNavigate={() => setSidebarOpen(false)} 
              unreadCount={unreadCount}
              onLogoutClick={handleLogoutClick}
              anggotaName={anggota?.nama_lengkap || 'Anggota'}
            />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          <span className="font-bold truncate">{anggota?.nama_lengkap || 'RUKEM'}</span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="container py-6 px-4 lg:px-8 max-w-4xl">
          {children}
        </div>
      </main>

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