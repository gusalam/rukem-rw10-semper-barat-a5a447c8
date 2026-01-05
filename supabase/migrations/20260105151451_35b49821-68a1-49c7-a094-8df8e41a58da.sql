-- 1. Tambahkan kolom status_dalam_kk dengan nilai yang diizinkan
ALTER TABLE public.anggota 
ADD COLUMN IF NOT EXISTS status_dalam_kk TEXT;

-- 2. Migrasi data dari hubungan_kk ke status_dalam_kk
-- Mapping: 'Kepala Keluarga' -> 'kepala_keluarga', 'Istri' -> 'istri', 'Anak' -> 'anak', dll
UPDATE public.anggota SET status_dalam_kk = 
  CASE 
    WHEN hubungan_kk = 'Kepala Keluarga' THEN 'kepala_keluarga'
    WHEN hubungan_kk = 'Istri' THEN 'istri'
    WHEN hubungan_kk = 'Anak' THEN 'anak'
    WHEN hubungan_kk = 'Orang Tua' THEN 'orang_tua'
    WHEN hubungan_kk = 'Anggota Keluarga Lainnya' THEN 'lainnya'
    WHEN hubungan_kk IS NOT NULL THEN 'famili'
    ELSE NULL
  END
WHERE status_dalam_kk IS NULL;

-- 3. Buat function untuk validasi status_dalam_kk
CREATE OR REPLACE FUNCTION public.validate_status_dalam_kk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  valid_values TEXT[] := ARRAY['kepala_keluarga', 'istri', 'anak', 'orang_tua', 'famili', 'lainnya'];
BEGIN
  -- Validate status_dalam_kk value
  IF NEW.status_dalam_kk IS NOT NULL AND NOT (NEW.status_dalam_kk = ANY(valid_values)) THEN
    RAISE EXCEPTION 'Nilai status_dalam_kk tidak valid. Nilai yang diizinkan: kepala_keluarga, istri, anak, orang_tua, famili, lainnya';
  END IF;

  -- Check if trying to set as kepala_keluarga
  IF NEW.status_dalam_kk = 'kepala_keluarga' THEN
    -- Check if another kepala_keluarga exists for this KK
    IF EXISTS (
      SELECT 1 FROM public.anggota 
      WHERE no_kk = NEW.no_kk 
      AND status_dalam_kk = 'kepala_keluarga'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Nomor KK % sudah memiliki Kepala Keluarga. Satu KK hanya boleh memiliki satu Kepala Keluarga.', NEW.no_kk;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Drop trigger lama jika ada dan buat trigger baru
DROP TRIGGER IF EXISTS validate_kepala_keluarga_trigger ON public.anggota;
DROP TRIGGER IF EXISTS validate_status_dalam_kk_trigger ON public.anggota;

CREATE TRIGGER validate_status_dalam_kk_trigger
BEFORE INSERT OR UPDATE ON public.anggota
FOR EACH ROW
EXECUTE FUNCTION public.validate_status_dalam_kk();

-- 5. Update function is_penagih_for_kk untuk menggunakan status_dalam_kk
CREATE OR REPLACE FUNCTION public.is_penagih_for_kk(_user_id uuid, _no_kk text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.penagih_wilayah pw
    JOIN public.anggota a ON a.rt = pw.rt AND a.rw = pw.rw
    WHERE pw.penagih_user_id = _user_id
      AND a.no_kk = _no_kk
      AND a.status_dalam_kk = 'kepala_keluarga'
  )
$function$;