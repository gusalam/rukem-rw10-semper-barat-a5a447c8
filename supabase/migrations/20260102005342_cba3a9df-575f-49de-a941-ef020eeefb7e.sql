-- Trigger: Notifikasi untuk anggota saat ada tagihan baru
CREATE OR REPLACE FUNCTION public.on_tagihan_created_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_record RECORD;
  v_periode_text TEXT;
  v_bulan TEXT;
BEGIN
  -- Format periode ke bahasa Indonesia
  v_bulan := CASE SUBSTRING(NEW.periode FROM 6 FOR 2)
    WHEN '01' THEN 'Januari'
    WHEN '02' THEN 'Februari'
    WHEN '03' THEN 'Maret'
    WHEN '04' THEN 'April'
    WHEN '05' THEN 'Mei'
    WHEN '06' THEN 'Juni'
    WHEN '07' THEN 'Juli'
    WHEN '08' THEN 'Agustus'
    WHEN '09' THEN 'September'
    WHEN '10' THEN 'Oktober'
    WHEN '11' THEN 'November'
    WHEN '12' THEN 'Desember'
  END;
  
  v_periode_text := v_bulan || ' ' || SUBSTRING(NEW.periode FROM 1 FOR 4);
  
  -- Send notification to all anggota in this KK
  FOR v_user_record IN 
    SELECT user_id FROM public.anggota 
    WHERE no_kk = NEW.no_kk 
    AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifikasi (user_id, judul, pesan)
    VALUES (
      v_user_record.user_id,
      'Tagihan Baru',
      'Tagihan iuran periode ' || v_periode_text || ' sebesar Rp ' || TO_CHAR(NEW.nominal, 'FM999,999,999') || ' telah dibuat. Jatuh tempo: ' || TO_CHAR(NEW.jatuh_tempo, 'DD Mon YYYY') || '.'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new tagihan
DROP TRIGGER IF EXISTS on_tagihan_created ON public.iuran_tagihan;
CREATE TRIGGER on_tagihan_created
  AFTER INSERT ON public.iuran_tagihan
  FOR EACH ROW EXECUTE FUNCTION public.on_tagihan_created_notify();

-- Trigger: Notifikasi untuk anggota saat iuran KK sudah lunas
CREATE OR REPLACE FUNCTION public.on_tagihan_lunas_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_record RECORD;
  v_periode_text TEXT;
  v_bulan TEXT;
BEGIN
  -- Only trigger when status changes to lunas
  IF NEW.status = 'lunas' AND OLD.status != 'lunas' THEN
    -- Format periode ke bahasa Indonesia
    v_bulan := CASE SUBSTRING(NEW.periode FROM 6 FOR 2)
      WHEN '01' THEN 'Januari'
      WHEN '02' THEN 'Februari'
      WHEN '03' THEN 'Maret'
      WHEN '04' THEN 'April'
      WHEN '05' THEN 'Mei'
      WHEN '06' THEN 'Juni'
      WHEN '07' THEN 'Juli'
      WHEN '08' THEN 'Agustus'
      WHEN '09' THEN 'September'
      WHEN '10' THEN 'Oktober'
      WHEN '11' THEN 'November'
      WHEN '12' THEN 'Desember'
    END;
    
    v_periode_text := v_bulan || ' ' || SUBSTRING(NEW.periode FROM 1 FOR 4);
    
    -- Send notification to all anggota in this KK
    FOR v_user_record IN 
      SELECT user_id FROM public.anggota 
      WHERE no_kk = NEW.no_kk 
      AND user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifikasi (user_id, judul, pesan)
      VALUES (
        v_user_record.user_id,
        'Iuran Lunas',
        'Pembayaran iuran periode ' || v_periode_text || ' telah diverifikasi dan dinyatakan LUNAS. Terima kasih atas partisipasi Anda.'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for tagihan status update
DROP TRIGGER IF EXISTS on_tagihan_lunas ON public.iuran_tagihan;
CREATE TRIGGER on_tagihan_lunas
  AFTER UPDATE ON public.iuran_tagihan
  FOR EACH ROW EXECUTE FUNCTION public.on_tagihan_lunas_notify();

-- Trigger: Notifikasi untuk penagih saat pembayaran disetujui/ditolak
CREATE OR REPLACE FUNCTION public.on_pembayaran_status_notify_penagih()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tagihan RECORD;
  v_periode_text TEXT;
  v_bulan TEXT;
  v_kepala_nama TEXT;
BEGIN
  -- Only trigger when status changes from menunggu_admin
  IF OLD.status = 'menunggu_admin' AND (NEW.status = 'disetujui' OR NEW.status = 'ditolak') THEN
    -- Get tagihan info
    SELECT * INTO v_tagihan FROM public.iuran_tagihan WHERE id = NEW.tagihan_id;
    
    -- Get kepala keluarga name
    SELECT nama_lengkap INTO v_kepala_nama 
    FROM public.anggota 
    WHERE no_kk = v_tagihan.no_kk AND hubungan_kk = 'Kepala Keluarga'
    LIMIT 1;
    
    IF v_kepala_nama IS NULL THEN
      SELECT nama_lengkap INTO v_kepala_nama 
      FROM public.anggota 
      WHERE no_kk = v_tagihan.no_kk
      LIMIT 1;
    END IF;
    
    -- Format periode ke bahasa Indonesia
    v_bulan := CASE SUBSTRING(v_tagihan.periode FROM 6 FOR 2)
      WHEN '01' THEN 'Januari'
      WHEN '02' THEN 'Februari'
      WHEN '03' THEN 'Maret'
      WHEN '04' THEN 'April'
      WHEN '05' THEN 'Mei'
      WHEN '06' THEN 'Juni'
      WHEN '07' THEN 'Juli'
      WHEN '08' THEN 'Agustus'
      WHEN '09' THEN 'September'
      WHEN '10' THEN 'Oktober'
      WHEN '11' THEN 'November'
      WHEN '12' THEN 'Desember'
    END;
    
    v_periode_text := v_bulan || ' ' || SUBSTRING(v_tagihan.periode FROM 1 FOR 4);
    
    IF NEW.status = 'disetujui' THEN
      INSERT INTO public.notifikasi (user_id, judul, pesan)
      VALUES (
        NEW.penagih_user_id,
        'Pembayaran Disetujui',
        'Pembayaran dari ' || COALESCE(v_kepala_nama, 'KK ' || v_tagihan.no_kk) || ' periode ' || v_periode_text || ' sebesar Rp ' || TO_CHAR(NEW.nominal, 'FM999,999,999') || ' telah DISETUJUI oleh admin.'
      );
    ELSIF NEW.status = 'ditolak' THEN
      INSERT INTO public.notifikasi (user_id, judul, pesan)
      VALUES (
        NEW.penagih_user_id,
        'Pembayaran Ditolak',
        'Pembayaran dari ' || COALESCE(v_kepala_nama, 'KK ' || v_tagihan.no_kk) || ' periode ' || v_periode_text || ' DITOLAK. Alasan: ' || COALESCE(NEW.alasan_tolak, 'Tidak ada alasan.')
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for pembayaran status change
DROP TRIGGER IF EXISTS on_pembayaran_status_change ON public.iuran_pembayaran;
CREATE TRIGGER on_pembayaran_status_change
  AFTER UPDATE ON public.iuran_pembayaran
  FOR EACH ROW EXECUTE FUNCTION public.on_pembayaran_status_notify_penagih();
