import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Anggota, PenagihWilayah } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  anggota: Anggota | null;
  penagihWilayah: PenagihWilayah[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isPenagih: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [anggota, setAnggota] = useState<Anggota | null>(null);
  const [penagihWilayah, setPenagihWilayah] = useState<PenagihWilayah[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string): Promise<void> => {
    try {
      // Fetch role - get the most recent one if multiple exist
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (roleData) {
        setRole(roleData.role as AppRole);
        
        // If penagih, fetch wilayah
        if (roleData.role === 'penagih') {
          const { data: wilayahData } = await supabase
            .from('penagih_wilayah')
            .select('*')
            .eq('penagih_user_id', userId);
          
          if (wilayahData) {
            setPenagihWilayah(wilayahData as PenagihWilayah[]);
          }
        } else {
          setPenagihWilayah([]);
        }
      }

      // Fetch anggota data if exists
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (anggotaData) {
        setAnggota(anggotaData as Anggota);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid deadlock, but wait for data before setting loading to false
          setTimeout(async () => {
            if (!isMounted) return;
            await fetchUserData(session.user.id);
            if (isMounted) setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setAnggota(null);
          setPenagihWilayah([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setAnggota(null);
    setPenagihWilayah([]);
  };

  const value = {
    user,
    session,
    role,
    anggota,
    penagihWilayah,
    loading,
    signIn,
    signOut,
    isAdmin: role === 'admin',
    isPenagih: role === 'penagih',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
