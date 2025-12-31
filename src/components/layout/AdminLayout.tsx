import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NetworkStatus } from '@/components/ui/network-status';
import {
  Heart,
  LayoutDashboard,
  Users,
  ClipboardList,
  CreditCard,
  UserCheck,
  Wallet,
  Skull,
  HandHeart,
  FileText,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react';

const adminMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: Users, label: 'Anggota', href: '/admin/anggota' },
  { icon: ClipboardList, label: 'Tagihan', href: '/admin/tagihan' },
  { icon: CreditCard, label: 'Verifikasi Bayar', href: '/admin/pembayaran' },
  { icon: UserCheck, label: 'Penagih', href: '/admin/penagih' },
  { icon: Wallet, label: 'Kas', href: '/admin/kas' },
  { icon: Skull, label: 'Kematian', href: '/admin/kematian' },
  { icon: HandHeart, label: 'Santunan', href: '/admin/santunan' },
  { icon: FileText, label: 'Laporan', href: '/admin/laporan' },
  { icon: Settings, label: 'Pengaturan', href: '/admin/pengaturan' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

function SidebarContent({ 
  onNavigate,
  onLogoutClick,
}: { 
  onNavigate?: () => void;
  onLogoutClick: () => void;
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
          <p className="text-xs text-muted-foreground">Admin Panel</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {adminMenuItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            
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
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
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

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
        <SidebarContent onLogoutClick={handleLogoutClick} />
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
              onLogoutClick={handleLogoutClick}
            />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          <span className="font-bold">RUKEM Admin</span>
        </div>

        <ThemeToggle className="ml-auto" />
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="container py-6 px-4 lg:px-8 max-w-7xl">
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