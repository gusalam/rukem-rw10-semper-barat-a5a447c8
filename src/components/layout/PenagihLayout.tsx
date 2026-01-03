import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NetworkStatus } from '@/components/ui/network-status';
import { Button } from '@/components/ui/button';
import {
  Home,
  Users,
  Receipt,
  LogOut,
  Menu,
  X,
  MapPin,
  CreditCard,
  TrendingUp,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PenagihLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { icon: Home, label: 'Ringkasan', path: '/penagih' },
  { icon: Receipt, label: 'Riwayat Tagihan', path: '/penagih/riwayat-tagihan' },
  { icon: CreditCard, label: 'Input Pembayaran', path: '/penagih/input-pembayaran' },
  { icon: TrendingUp, label: 'Rekap Uang', path: '/penagih/rekap-uang' },
  { icon: Users, label: 'Anggota Wilayah', path: '/penagih/anggota' },
  { icon: User, label: 'Profil', path: '/penagih/profil' },
];

export function PenagihLayout({ children }: PenagihLayoutProps) {
  const location = useLocation();
  const { penagihWilayah, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const wilayahText = penagihWilayah.length > 0
    ? penagihWilayah.map(w => `RT ${w.rt}/RW ${w.rw}`).join(', ')
    : 'Belum ada wilayah';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="font-semibold">Penagih</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="border-t bg-background p-4 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => {
                setMobileMenuOpen(false);
                setLogoutDialogOpen(true);
              }}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Keluar
            </Button>
          </nav>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-bold text-lg">Portal Penagih</h1>
              <p className="text-xs text-muted-foreground">{wilayahText}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2">
          <div className="flex items-center justify-between px-4">
            <span className="text-sm text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => setLogoutDialogOpen(true)}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8 animate-fade-in">
          {children}
        </div>
      </main>

      <NetworkStatus />
      
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={signOut}
      />
    </div>
  );
}
