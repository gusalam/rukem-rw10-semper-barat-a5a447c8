import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NetworkStatus } from '@/components/ui/network-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Home,
  Users,
  Receipt,
  LogOut,
  MapPin,
  CreditCard,
  Wallet,
  User,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PenagihLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  title?: string;
}

const menuItems = [
  { icon: Home, label: 'Ringkasan', path: '/penagih/ringkasan' },
  { icon: Receipt, label: 'Riwayat Tagihan', path: '/penagih/riwayat-tagihan' },
  { icon: CreditCard, label: 'Input Pembayaran', path: '/penagih/input-pembayaran' },
  { icon: Wallet, label: 'Rekap Uang', path: '/penagih/rekap-uang' },
  { icon: Users, label: 'Anggota', path: '/penagih/anggota' },
  { icon: User, label: 'Profil', path: '/penagih/profil' },
];

export function PenagihLayout({ children, showBackButton = true, title }: PenagihLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { penagihWilayah, signOut } = useAuth();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const wilayahText = penagihWilayah.length > 0
    ? penagihWilayah.map(w => `RT ${w.rt}/RW ${w.rw}`).join(', ')
    : 'Belum ada wilayah';

  // Check if current page is dashboard/home
  const isDashboard = location.pathname === '/penagih';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {showBackButton && !isDashboard && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/penagih')}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {isDashboard ? (
              <>
                <div className="p-2 rounded-full bg-primary/10">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">Portal Penagih</h1>
                  <p className="text-xs text-muted-foreground">{wilayahText}</p>
                </div>
              </>
            ) : (
              <div>
                <h1 className="font-bold text-lg">{title || getPageTitle(location.pathname)}</h1>
                <p className="text-xs text-muted-foreground">{wilayahText}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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

      {/* Main content */}
      <main className="min-h-[calc(100vh-65px)] pb-20 lg:pb-8">
        <div className="p-4 animate-fade-in">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t lg:hidden z-50">
        <div className="grid grid-cols-6 gap-1 p-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/penagih/ringkasan' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] mt-1 truncate text-center leading-tight">
                  {item.label.split(' ')[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Bottom Menu Bar */}
      <nav className="hidden lg:block fixed bottom-0 left-0 right-0 bg-background border-t z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 p-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/penagih/ringkasan' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
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

      <NetworkStatus />
      
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={signOut}
      />
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/penagih': 'Portal Penagih',
    '/penagih/ringkasan': 'Ringkasan',
    '/penagih/riwayat-tagihan': 'Riwayat Tagihan',
    '/penagih/input-pembayaran': 'Input Pembayaran',
    '/penagih/rekap-uang': 'Rekap Uang',
    '/penagih/anggota': 'Anggota Wilayah',
    '/penagih/profil': 'Profil',
    '/penagih/tagihan': 'Detail Tagihan',
  };
  
  // Check for dynamic routes
  if (pathname.startsWith('/penagih/tagihan/')) {
    return 'Detail Tagihan KK';
  }
  
  return titles[pathname] || 'Penagih';
}
