import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, User, Shield } from 'lucide-react';

export default function ProfilPage() {
  const { user, penagihWilayah } = useAuth();

  const getInitials = (email: string) => {
    return email?.substring(0, 2).toUpperCase() || 'P';
  };

  return (
    <PenagihLayout>
      <PageHeader 
        title="Profil Saya" 
        description="Informasi akun penagih"
      />

      <div className="max-w-2xl space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informasi Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {getInitials(user?.email || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-lg">Penagih</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Shield className="h-4 w-4 text-primary" />
              <Badge variant="outline">Role: Penagih</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Wilayah Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Wilayah Tugas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {penagihWilayah.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada wilayah yang ditugaskan.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {penagihWilayah.map((w, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg"
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">RT {w.rt} / RW {w.rw}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Anda hanya dapat melihat dan mengelola tagihan di wilayah yang ditugaskan.
            </p>
          </CardContent>
        </Card>
      </div>
    </PenagihLayout>
  );
}
