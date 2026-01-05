import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/admin/Dashboard";
import AnggotaPage from "./pages/admin/AnggotaPage";
import KasPage from "./pages/admin/KasPage";
import KematianPage from "./pages/admin/KematianPage";
import SantunanPage from "./pages/admin/SantunanPage";
import LaporanPage from "./pages/admin/LaporanPage";
import PengaturanPage from "./pages/admin/PengaturanPage";
import TagihanPage from "./pages/admin/TagihanPage";
import PembayaranPage from "./pages/admin/PembayaranPage";
import PenagihPage from "./pages/admin/PenagihPage";
import ValidasiDataPage from "./pages/admin/ValidasiDataPage";
import AnggotaDashboard from "./pages/anggota/Dashboard";
import AnggotaNotifikasiPage from "./pages/anggota/NotifikasiPage";
import AnggotaIuranPage from "./pages/anggota/IuranPage";
import AnggotaRiwayatPage from "./pages/anggota/RiwayatPage";
import AnggotaKeluargaPage from "./pages/anggota/KeluargaPage";
import AnggotaSantunanPage from "./pages/anggota/SantunanPage";
import AnggotaProfilPage from "./pages/anggota/ProfilPage";
import RingkasanPage from "./pages/penagih/RingkasanPage";
import PenagihDashboard from "./pages/penagih/Dashboard";
import PenagihAnggotaPage from "./pages/penagih/AnggotaPage";
import PenagihTagihanPage from "./pages/penagih/TagihanPage";
import RiwayatTagihanPage from "./pages/penagih/RiwayatTagihanPage";
import InputPembayaranPage from "./pages/penagih/InputPembayaranPage";
import RekapUangPage from "./pages/penagih/RekapUangPage";
import PenagihProfilPage from "./pages/penagih/ProfilPage";
import DetailTagihanKKPage from "./pages/penagih/DetailTagihanKKPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function RoleBasedRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'penagih') {
    return <Navigate to="/penagih" replace />;
  }

  return <Navigate to="/anggota" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RoleBasedRedirect />} />
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/anggota" element={<ProtectedRoute requiredRole="admin"><AnggotaPage /></ProtectedRoute>} />
            {/* Route /admin/iuran dihapus - gunakan /admin/tagihan */}
            <Route path="/admin/tagihan" element={<ProtectedRoute requiredRole="admin"><TagihanPage /></ProtectedRoute>} />
            <Route path="/admin/pembayaran" element={<ProtectedRoute requiredRole="admin"><PembayaranPage /></ProtectedRoute>} />
            <Route path="/admin/penagih" element={<ProtectedRoute requiredRole="admin"><PenagihPage /></ProtectedRoute>} />
            <Route path="/admin/kas" element={<ProtectedRoute requiredRole="admin"><KasPage /></ProtectedRoute>} />
            <Route path="/admin/kematian" element={<ProtectedRoute requiredRole="admin"><KematianPage /></ProtectedRoute>} />
            <Route path="/admin/santunan" element={<ProtectedRoute requiredRole="admin"><SantunanPage /></ProtectedRoute>} />
            <Route path="/admin/laporan" element={<ProtectedRoute requiredRole="admin"><LaporanPage /></ProtectedRoute>} />
            <Route path="/admin/validasi-data" element={<ProtectedRoute requiredRole="admin"><ValidasiDataPage /></ProtectedRoute>} />
            <Route path="/admin/pengaturan" element={<ProtectedRoute requiredRole="admin"><PengaturanPage /></ProtectedRoute>} />
            
            {/* Penagih Routes */}
            <Route path="/penagih" element={<ProtectedRoute requiredRole="penagih"><PenagihDashboard /></ProtectedRoute>} />
            <Route path="/penagih/ringkasan" element={<ProtectedRoute requiredRole="penagih"><RingkasanPage /></ProtectedRoute>} />
            <Route path="/penagih/riwayat-tagihan" element={<ProtectedRoute requiredRole="penagih"><RiwayatTagihanPage /></ProtectedRoute>} />
            <Route path="/penagih/input-pembayaran" element={<ProtectedRoute requiredRole="penagih"><InputPembayaranPage /></ProtectedRoute>} />
            <Route path="/penagih/rekap-uang" element={<ProtectedRoute requiredRole="penagih"><RekapUangPage /></ProtectedRoute>} />
            <Route path="/penagih/anggota" element={<ProtectedRoute requiredRole="penagih"><PenagihAnggotaPage /></ProtectedRoute>} />
            <Route path="/penagih/tagihan" element={<ProtectedRoute requiredRole="penagih"><PenagihTagihanPage /></ProtectedRoute>} />
            <Route path="/penagih/tagihan/:noKK" element={<ProtectedRoute requiredRole="penagih"><DetailTagihanKKPage /></ProtectedRoute>} />
            <Route path="/penagih/profil" element={<ProtectedRoute requiredRole="penagih"><PenagihProfilPage /></ProtectedRoute>} />
            
            {/* Anggota Routes */}
            <Route path="/anggota" element={<ProtectedRoute requiredRole="anggota"><AnggotaDashboard /></ProtectedRoute>} />
            <Route path="/anggota/notifikasi" element={<ProtectedRoute requiredRole="anggota"><AnggotaNotifikasiPage /></ProtectedRoute>} />
            <Route path="/anggota/iuran" element={<ProtectedRoute requiredRole="anggota"><AnggotaIuranPage /></ProtectedRoute>} />
            <Route path="/anggota/riwayat" element={<ProtectedRoute requiredRole="anggota"><AnggotaRiwayatPage /></ProtectedRoute>} />
            <Route path="/anggota/keluarga" element={<ProtectedRoute requiredRole="anggota"><AnggotaKeluargaPage /></ProtectedRoute>} />
            <Route path="/anggota/santunan" element={<ProtectedRoute requiredRole="anggota"><AnggotaSantunanPage /></ProtectedRoute>} />
            <Route path="/anggota/profil" element={<ProtectedRoute requiredRole="anggota"><AnggotaProfilPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
