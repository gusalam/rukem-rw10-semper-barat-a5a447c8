-- Create enums for status and roles
CREATE TYPE public.app_role AS ENUM ('admin', 'anggota');
CREATE TYPE public.status_anggota AS ENUM ('aktif', 'nonaktif', 'meninggal');
CREATE TYPE public.status_iuran AS ENUM ('belum_bayar', 'menunggu_verifikasi', 'lunas', 'ditolak');
CREATE TYPE public.jenis_iuran AS ENUM ('bulanan', 'per_kejadian', 'darurat');
CREATE TYPE public.jenis_kas AS ENUM ('pemasukan', 'pengeluaran');
CREATE TYPE public.metode_pembayaran AS ENUM ('tunai', 'transfer', 'qris');
CREATE TYPE public.status_santunan AS ENUM ('pending', 'diproses', 'disalurkan');

-- System settings table
CREATE TABLE public.pengaturan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_rukem TEXT NOT NULL DEFAULT 'Rukun Kematian',
  nominal_iuran BIGINT NOT NULL DEFAULT 50000,
  periode_iuran TEXT NOT NULL DEFAULT 'bulanan',
  nominal_santunan BIGINT NOT NULL DEFAULT 5000000,
  aturan_tunggakan TEXT,
  nama_bank TEXT,
  nomor_rekening TEXT,
  nama_pemilik_rekening TEXT,
  qris_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'anggota',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Profiles table for basic user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members table (anggota)
CREATE TABLE public.anggota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nama_lengkap TEXT NOT NULL,
  nik TEXT NOT NULL UNIQUE,
  no_kk TEXT NOT NULL,
  alamat TEXT NOT NULL,
  no_hp TEXT NOT NULL,
  tanggal_lahir DATE,
  jenis_kelamin TEXT,
  status status_anggota NOT NULL DEFAULT 'aktif',
  tanggal_bergabung DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Family members table
CREATE TABLE public.keluarga_anggota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID REFERENCES public.anggota(id) ON DELETE CASCADE NOT NULL,
  nama TEXT NOT NULL,
  hubungan TEXT NOT NULL,
  tanggal_lahir DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dues/contributions table (iuran)
CREATE TABLE public.iuran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID REFERENCES public.anggota(id) ON DELETE CASCADE NOT NULL,
  periode TEXT NOT NULL,
  jenis jenis_iuran NOT NULL DEFAULT 'bulanan',
  nominal BIGINT NOT NULL,
  status status_iuran NOT NULL DEFAULT 'belum_bayar',
  jatuh_tempo DATE NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment proof table
CREATE TABLE public.pembayaran_iuran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iuran_id UUID REFERENCES public.iuran(id) ON DELETE CASCADE NOT NULL,
  anggota_id UUID REFERENCES public.anggota(id) ON DELETE CASCADE NOT NULL,
  bukti_url TEXT,
  nominal BIGINT NOT NULL,
  metode metode_pembayaran NOT NULL DEFAULT 'transfer',
  tanggal_bayar TIMESTAMPTZ NOT NULL DEFAULT now(),
  catatan TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  alasan_tolak TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cash/treasury table (kas)
CREATE TABLE public.kas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis jenis_kas NOT NULL,
  nominal BIGINT NOT NULL,
  keterangan TEXT NOT NULL,
  referensi_id UUID,
  referensi_tipe TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Death records table (kematian)
CREATE TABLE public.kematian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anggota_id UUID REFERENCES public.anggota(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tanggal_meninggal DATE NOT NULL,
  tempat_meninggal TEXT,
  penyebab TEXT,
  keterangan TEXT,
  status_iuran_terakhir TEXT,
  tunggakan_total BIGINT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Benefit/compensation table (santunan)
CREATE TABLE public.santunan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kematian_id UUID REFERENCES public.kematian(id) ON DELETE CASCADE NOT NULL UNIQUE,
  anggota_id UUID REFERENCES public.anggota(id) ON DELETE CASCADE NOT NULL,
  nominal_dasar BIGINT NOT NULL,
  potongan_tunggakan BIGINT DEFAULT 0,
  nominal_akhir BIGINT NOT NULL,
  status status_santunan NOT NULL DEFAULT 'pending',
  tanggal_penyaluran DATE,
  metode metode_pembayaran,
  penerima TEXT,
  bukti_url TEXT,
  catatan TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifikasi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  judul TEXT NOT NULL,
  pesan TEXT NOT NULL,
  dibaca BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  aksi TEXT NOT NULL,
  tabel TEXT NOT NULL,
  record_id UUID,
  data_lama JSONB,
  data_baru JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.pengaturan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keluarga_anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iuran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran_iuran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kematian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.santunan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's anggota_id
CREATE OR REPLACE FUNCTION public.get_anggota_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.anggota WHERE user_id = _user_id LIMIT 1
$$;

-- Function to get current kas balance
CREATE OR REPLACE FUNCTION public.get_saldo_kas()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN jenis = 'pemasukan' THEN nominal ELSE -nominal END),
    0
  )::BIGINT FROM public.kas
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_pengaturan_updated_at BEFORE UPDATE ON public.pengaturan FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_anggota_updated_at BEFORE UPDATE ON public.anggota FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_iuran_updated_at BEFORE UPDATE ON public.iuran FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_santunan_updated_at BEFORE UPDATE ON public.santunan FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Pengaturan: Admin can do everything, anggota can view
CREATE POLICY "Admin can manage pengaturan" ON public.pengaturan FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view pengaturan" ON public.pengaturan FOR SELECT TO authenticated USING (true);

-- User roles: Admin can manage, users can view their own
CREATE POLICY "Admin can manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Profiles: Admin can manage all, users can view and update own
CREATE POLICY "Admin can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Anggota: Admin can manage all, anggota can view own
CREATE POLICY "Admin can manage anggota" ON public.anggota FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view own data" ON public.anggota FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Keluarga anggota: Admin can manage, anggota can view own
CREATE POLICY "Admin can manage keluarga" ON public.keluarga_anggota FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view own keluarga" ON public.keluarga_anggota FOR SELECT TO authenticated USING (
  anggota_id = public.get_anggota_id(auth.uid())
);

-- Iuran: Admin can manage, anggota can view own
CREATE POLICY "Admin can manage iuran" ON public.iuran FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view own iuran" ON public.iuran FOR SELECT TO authenticated USING (
  anggota_id = public.get_anggota_id(auth.uid())
);

-- Pembayaran iuran: Admin can manage, anggota can view and insert own
CREATE POLICY "Admin can manage pembayaran" ON public.pembayaran_iuran FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view own pembayaran" ON public.pembayaran_iuran FOR SELECT TO authenticated USING (
  anggota_id = public.get_anggota_id(auth.uid())
);
CREATE POLICY "Anggota can insert pembayaran" ON public.pembayaran_iuran FOR INSERT TO authenticated WITH CHECK (
  anggota_id = public.get_anggota_id(auth.uid())
);

-- Kas: Admin can manage, anggota can view
CREATE POLICY "Admin can manage kas" ON public.kas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view kas" ON public.kas FOR SELECT TO authenticated USING (true);

-- Kematian: Admin can manage, anggota can view
CREATE POLICY "Admin can manage kematian" ON public.kematian FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view kematian" ON public.kematian FOR SELECT TO authenticated USING (true);

-- Santunan: Admin can manage, anggota can view
CREATE POLICY "Admin can manage santunan" ON public.santunan FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anggota can view santunan" ON public.santunan FOR SELECT TO authenticated USING (true);

-- Notifikasi: Users can view and update own
CREATE POLICY "Users can view own notifikasi" ON public.notifikasi FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifikasi" ON public.notifikasi FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin can insert notifikasi" ON public.notifikasi FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Audit log: Admin only
CREATE POLICY "Admin can view audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default settings
INSERT INTO public.pengaturan (nama_rukem, nominal_iuran, periode_iuran, nominal_santunan) 
VALUES ('Rukun Kematian', 50000, 'bulanan', 5000000);

-- Create indexes for better performance
CREATE INDEX idx_anggota_user_id ON public.anggota(user_id);
CREATE INDEX idx_anggota_status ON public.anggota(status);
CREATE INDEX idx_iuran_anggota_id ON public.iuran(anggota_id);
CREATE INDEX idx_iuran_status ON public.iuran(status);
CREATE INDEX idx_pembayaran_iuran_id ON public.pembayaran_iuran(iuran_id);
CREATE INDEX idx_kas_jenis ON public.kas(jenis);
CREATE INDEX idx_notifikasi_user_id ON public.notifikasi(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);