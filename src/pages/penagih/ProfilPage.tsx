import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, User, Shield } from 'lucide-react';

export default function ProfilPage() {
  const { user, penagihWilayah } = useAuth();

  const getInitials = (email: string) => {
    return email?.substring(0, 2).toUpperCase() || 'P';
  };

  return (
    <PenagihLayout title="Profil">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-pink-500/20">
                <User className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Profil Saya</h2>
                <p className="text-sm text-muted-foreground">Informasi akun penagih</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {getInitials(user?.email || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-lg">Penagih</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge variant="outline">Penagih</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Wilayah Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Wilayah Tugas</h3>
            </div>
            
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
