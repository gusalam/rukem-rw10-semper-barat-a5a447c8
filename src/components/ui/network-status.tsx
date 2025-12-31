import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  className?: string;
}

export function NetworkStatus({ className }: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    // Check for slow connection using Network Information API
    const checkConnectionSpeed = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      if (connection) {
        const slowTypes = ['slow-2g', '2g'];
        const isSlow = slowTypes.includes(connection.effectiveType) || 
                       connection.downlink < 0.5 || // Less than 0.5 Mbps
                       connection.rtt > 1000; // Round-trip time > 1 second
        
        setIsSlowConnection(isSlow);
        if (isSlow) setShowBanner(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection speed on mount and when connection changes
    checkConnectionSpeed();
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', checkConnectionSpeed);
    }

    // Initial check
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', checkConnectionSpeed);
      }
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  if (!showBanner) return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300",
        className
      )}
    >
      <div className={cn(
        "flex items-center justify-center gap-3 py-3 px-4 text-sm font-medium",
        !isOnline 
          ? "bg-destructive text-destructive-foreground" 
          : "bg-warning text-warning-foreground"
      )}>
        <WifiOff className="h-4 w-4" />
        <span>
          {!isOnline 
            ? "Tidak ada koneksi internet. Periksa jaringan Anda." 
            : isSlowConnection 
              ? "Koneksi internet lambat. Beberapa fitur mungkin tidak berfungsi optimal."
              : "Memeriksa koneksi..."}
        </span>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleRetry}
          className="ml-2 h-7 px-3"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Coba Lagi
        </Button>
        {(isOnline && isSlowConnection) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowBanner(false)}
            className="ml-1 h-7 px-2 hover:bg-warning-foreground/10"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}

// Hook untuk mengecek status online secara reaktif
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const updateConnectionType = () => {
      const connection = (navigator as any).connection;
      if (connection) {
        setConnectionType(connection.effectiveType);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection;
    if (connection) {
      updateConnectionType();
      connection.addEventListener('change', updateConnectionType);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionType);
      }
    };
  }, []);

  return { isOnline, connectionType };
}
