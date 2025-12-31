-- =============================================
-- 2. BUAT TABEL PENAGIH_WILAYAH
-- =============================================
CREATE TABLE IF NOT EXISTS public.penagih_wilayah (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  penagih_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rt text NOT NULL,
  rw text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(penagih_user_id, rt, rw)
);

ALTER TABLE public.penagih_wilayah ENABLE ROW LEVEL SECURITY;

-- RLS untuk penagih_wilayah
CREATE POLICY "Admin can manage penagih_wilayah"
ON public.penagih_wilayah FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Penagih can view own wilayah"
ON public.penagih_wilayah FOR SELECT
USING (penagih_user_id = auth.uid());

-- =============================================
-- 3. BUAT TABEL IURAN_TAGIHAN (PER KK)
-- =============================================
CREATE TYPE public.status_tagihan AS ENUM ('belum_bayar', 'menunggu_admin', 'lunas');

CREATE TABLE IF NOT EXISTS public.iuran_tagihan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_kk text NOT NULL,
  periode text NOT NULL,
  nominal bigint NOT NULL,
  status status_tagihan NOT NULL DEFAULT 'belum_bayar',
  jatuh_tempo date NOT NULL,
  keterangan text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(no_kk, periode)
);

ALTER TABLE public.iuran_tagihan ENABLE ROW LEVEL SECURITY;

-- Trigger update timestamp
CREATE TRIGGER update_iuran_tagihan_updated_at
BEFORE UPDATE ON public.iuran_tagihan
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. BUAT TABEL IURAN_PEMBAYARAN
-- =============================================
CREATE TYPE public.status_pembayaran_tagihan AS ENUM ('menunggu_admin', 'disetujui', 'ditolak');

CREATE TABLE IF NOT EXISTS public.iuran_pembayaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id uuid NOT NULL REFERENCES public.iuran_tagihan(id) ON DELETE CASCADE,
  penagih_user_id uuid NOT NULL REFERENCES auth.users(id),
  tanggal_bayar timestamptz NOT NULL DEFAULT now(),
  nominal bigint NOT NULL,
  metode metode_pembayaran NOT NULL DEFAULT 'tunai',
  bukti_url text,
  catatan text,
  status status_pembayaran_tagihan NOT NULL DEFAULT 'menunggu_admin',
  approved_by uuid,
  approved_at timestamptz,
  alasan_tolak text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iuran_pembayaran ENABLE ROW LEVEL SECURITY;

-- Trigger update timestamp
CREATE TRIGGER update_iuran_pembayaran_updated_at
BEFORE UPDATE ON public.iuran_pembayaran
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. FUNCTION: CHECK PENAGIH WILAYAH
-- =============================================
CREATE OR REPLACE FUNCTION public.is_penagih_for_kk(_user_id uuid, _no_kk text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.penagih_wilayah pw
    JOIN public.anggota a ON a.rt = pw.rt AND a.rw = pw.rw
    WHERE pw.penagih_user_id = _user_id
      AND a.no_kk = _no_kk
      AND a.hubungan_kk = 'Kepala Keluarga'
  )
$$;

-- =============================================
-- 6. FUNCTION: GET PENAGIH WILAYAH RT/RW
-- =============================================
CREATE OR REPLACE FUNCTION public.get_penagih_wilayah(_user_id uuid)
RETURNS TABLE(rt text, rw text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pw.rt, pw.rw
  FROM public.penagih_wilayah pw
  WHERE pw.penagih_user_id = _user_id
$$;

-- =============================================
-- 7. RLS POLICIES UNTUK IURAN_TAGIHAN
-- =============================================
-- Admin full access
CREATE POLICY "Admin can manage iuran_tagihan"
ON public.iuran_tagihan FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Penagih dapat melihat tagihan di wilayahnya
CREATE POLICY "Penagih can view tagihan in wilayah"
ON public.iuran_tagihan FOR SELECT
USING (
  public.has_role(auth.uid(), 'penagih') AND
  EXISTS (
    SELECT 1 FROM public.penagih_wilayah pw
    JOIN public.anggota a ON a.rt = pw.rt AND a.rw = pw.rw
    WHERE pw.penagih_user_id = auth.uid()
      AND a.no_kk = iuran_tagihan.no_kk
      AND a.hubungan_kk = 'Kepala Keluarga'
  )
);

-- Anggota dapat melihat tagihan KK sendiri (read only)
CREATE POLICY "Anggota can view own KK tagihan"
ON public.iuran_tagihan FOR SELECT
USING (no_kk = public.get_anggota_no_kk(auth.uid()));

-- =============================================
-- 8. RLS POLICIES UNTUK IURAN_PEMBAYARAN
-- =============================================
-- Admin full access
CREATE POLICY "Admin can manage iuran_pembayaran"
ON public.iuran_pembayaran FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Penagih dapat insert pembayaran untuk wilayahnya
CREATE POLICY "Penagih can insert pembayaran in wilayah"
ON public.iuran_pembayaran FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'penagih') AND
  penagih_user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.iuran_tagihan t
    WHERE t.id = tagihan_id
      AND public.is_penagih_for_kk(auth.uid(), t.no_kk)
  )
);

-- Penagih dapat melihat pembayaran yang dibuatnya
CREATE POLICY "Penagih can view own pembayaran"
ON public.iuran_pembayaran FOR SELECT
USING (
  public.has_role(auth.uid(), 'penagih') AND
  penagih_user_id = auth.uid()
);

-- Anggota dapat melihat pembayaran KK sendiri
CREATE POLICY "Anggota can view own KK pembayaran"
ON public.iuran_pembayaran FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.iuran_tagihan t
    WHERE t.id = tagihan_id
      AND t.no_kk = public.get_anggota_no_kk(auth.uid())
  )
);

-- =============================================
-- 9. TRIGGER: AUTO UPDATE TAGIHAN & KAS SAAT PEMBAYARAN DISETUJUI
-- =============================================
CREATE OR REPLACE FUNCTION public.on_pembayaran_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hanya trigger ketika status berubah menjadi disetujui
  IF NEW.status = 'disetujui' AND OLD.status = 'menunggu_admin' THEN
    -- Update status tagihan menjadi lunas
    UPDATE public.iuran_tagihan 
    SET status = 'lunas', updated_at = now()
    WHERE id = NEW.tagihan_id;
    
    -- Insert ke kas (pemasukan dari iuran)
    INSERT INTO public.kas (jenis, nominal, keterangan, referensi_id, referensi_tipe, created_by)
    VALUES (
      'pemasukan',
      NEW.nominal,
      'Pembayaran iuran dari penagih',
      NEW.id,
      'iuran_pembayaran',
      NEW.approved_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_pembayaran_approved
AFTER UPDATE ON public.iuran_pembayaran
FOR EACH ROW
EXECUTE FUNCTION public.on_pembayaran_approved();

-- =============================================
-- 10. CONSTRAINT: SATU TAGIHAN HANYA BOLEH PUNYA SATU PEMBAYARAN DISETUJUI
-- =============================================
CREATE OR REPLACE FUNCTION public.check_single_approved_pembayaran()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'disetujui' THEN
    IF EXISTS (
      SELECT 1 FROM public.iuran_pembayaran
      WHERE tagihan_id = NEW.tagihan_id
        AND status = 'disetujui'
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Tagihan ini sudah memiliki pembayaran yang disetujui';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_single_approved
BEFORE UPDATE ON public.iuran_pembayaran
FOR EACH ROW
EXECUTE FUNCTION public.check_single_approved_pembayaran();

-- =============================================
-- 11. FUNCTION: VALIDASI PENAGIH WILAYAH SAAT INSERT
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_penagih_wilayah()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.iuran_tagihan t
    WHERE t.id = NEW.tagihan_id
      AND public.is_penagih_for_kk(NEW.penagih_user_id, t.no_kk)
  ) THEN
    RAISE EXCEPTION 'Penagih tidak memiliki akses ke wilayah KK ini';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_penagih_wilayah
BEFORE INSERT ON public.iuran_pembayaran
FOR EACH ROW
EXECUTE FUNCTION public.validate_penagih_wilayah();