-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Create storage buckets for payment proofs and santunan proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bukti_pembayaran', 'bukti_pembayaran', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('bukti_santunan', 'bukti_santunan', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bukti_pembayaran
CREATE POLICY "Admin can access all bukti_pembayaran"
ON storage.objects FOR ALL
USING (bucket_id = 'bukti_pembayaran' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'bukti_pembayaran' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anggota can upload own bukti_pembayaran"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bukti_pembayaran' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anggota can view own bukti_pembayaran"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'bukti_pembayaran' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for bukti_santunan
CREATE POLICY "Admin can access all bukti_santunan"
ON storage.objects FOR ALL
USING (bucket_id = 'bukti_santunan' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'bukti_santunan' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anggota can view bukti_santunan"
ON storage.objects FOR SELECT
USING (bucket_id = 'bukti_santunan');

-- =====================================================
-- AUTOMATION FUNCTIONS
-- =====================================================

-- Function: Update iuran status when payment is submitted
CREATE OR REPLACE FUNCTION public.on_pembayaran_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update iuran status to menunggu_verifikasi
  UPDATE public.iuran 
  SET status = 'menunggu_verifikasi', updated_at = now()
  WHERE id = NEW.iuran_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for pembayaran insert
DROP TRIGGER IF EXISTS trigger_on_pembayaran_insert ON public.pembayaran_iuran;
CREATE TRIGGER trigger_on_pembayaran_insert
AFTER INSERT ON public.pembayaran_iuran
FOR EACH ROW
EXECUTE FUNCTION public.on_pembayaran_insert();

-- Function: Handle payment verification (approved)
CREATE OR REPLACE FUNCTION public.on_pembayaran_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when verified_at is set (payment approved)
  IF NEW.verified_at IS NOT NULL AND OLD.verified_at IS NULL AND NEW.alasan_tolak IS NULL THEN
    -- Update iuran status to lunas
    UPDATE public.iuran 
    SET status = 'lunas', updated_at = now()
    WHERE id = NEW.iuran_id;
    
    -- Insert kas record (pemasukan from iuran)
    INSERT INTO public.kas (jenis, nominal, keterangan, referensi_id, referensi_tipe, created_by)
    VALUES (
      'pemasukan',
      NEW.nominal,
      'Pembayaran iuran dari anggota',
      NEW.id,
      'pembayaran_iuran',
      NEW.verified_by
    );
  END IF;
  
  -- If payment is rejected
  IF NEW.alasan_tolak IS NOT NULL AND OLD.alasan_tolak IS NULL THEN
    UPDATE public.iuran 
    SET status = 'ditolak', updated_at = now()
    WHERE id = NEW.iuran_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for payment verification
DROP TRIGGER IF EXISTS trigger_on_pembayaran_verified ON public.pembayaran_iuran;
CREATE TRIGGER trigger_on_pembayaran_verified
AFTER UPDATE ON public.pembayaran_iuran
FOR EACH ROW
EXECUTE FUNCTION public.on_pembayaran_verified();

-- Function: Auto-calculate santunan when kematian is created
CREATE OR REPLACE FUNCTION public.on_kematian_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tunggakan BIGINT;
  v_nominal_santunan BIGINT;
  v_nominal_akhir BIGINT;
  v_status_iuran TEXT;
BEGIN
  -- Get nominal santunan from pengaturan
  SELECT nominal_santunan INTO v_nominal_santunan FROM public.pengaturan LIMIT 1;
  
  -- Calculate total tunggakan (unpaid iuran)
  SELECT COALESCE(SUM(nominal), 0) INTO v_tunggakan
  FROM public.iuran
  WHERE anggota_id = NEW.anggota_id AND status IN ('belum_bayar', 'menunggu_verifikasi', 'ditolak');
  
  -- Get last iuran status
  SELECT status::TEXT INTO v_status_iuran
  FROM public.iuran
  WHERE anggota_id = NEW.anggota_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Calculate final santunan amount
  v_nominal_akhir := GREATEST(v_nominal_santunan - v_tunggakan, 0);
  
  -- Update kematian with tunggakan info
  UPDATE public.kematian
  SET tunggakan_total = v_tunggakan, status_iuran_terakhir = v_status_iuran
  WHERE id = NEW.id;
  
  -- Auto-create santunan record
  INSERT INTO public.santunan (
    kematian_id, 
    anggota_id, 
    nominal_dasar, 
    potongan_tunggakan, 
    nominal_akhir, 
    status
  )
  VALUES (
    NEW.id,
    NEW.anggota_id,
    v_nominal_santunan,
    v_tunggakan,
    v_nominal_akhir,
    'pending'
  );
  
  -- Update anggota status to meninggal
  UPDATE public.anggota
  SET status = 'meninggal', updated_at = now()
  WHERE id = NEW.anggota_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for kematian insert
DROP TRIGGER IF EXISTS trigger_on_kematian_insert ON public.kematian;
CREATE TRIGGER trigger_on_kematian_insert
AFTER INSERT ON public.kematian
FOR EACH ROW
EXECUTE FUNCTION public.on_kematian_insert();

-- Function: Handle santunan disbursement
CREATE OR REPLACE FUNCTION public.on_santunan_disbursed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When santunan is marked as disalurkan
  IF NEW.status = 'disalurkan' AND OLD.status != 'disalurkan' THEN
    -- Insert kas record (pengeluaran for santunan)
    INSERT INTO public.kas (jenis, nominal, keterangan, referensi_id, referensi_tipe, created_by)
    VALUES (
      'pengeluaran',
      NEW.nominal_akhir,
      'Penyaluran santunan kematian',
      NEW.id,
      'santunan',
      NEW.processed_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for santunan disbursement
DROP TRIGGER IF EXISTS trigger_on_santunan_disbursed ON public.santunan;
CREATE TRIGGER trigger_on_santunan_disbursed
AFTER UPDATE ON public.santunan
FOR EACH ROW
EXECUTE FUNCTION public.on_santunan_disbursed();

-- =====================================================
-- ENABLE REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.iuran;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pembayaran_iuran;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kematian;
ALTER PUBLICATION supabase_realtime ADD TABLE public.santunan;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifikasi;