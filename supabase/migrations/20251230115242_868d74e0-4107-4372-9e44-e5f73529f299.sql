-- Add new columns for Dukcapil-like data
ALTER TABLE public.anggota
ADD COLUMN IF NOT EXISTS tempat_lahir text,
ADD COLUMN IF NOT EXISTS agama text,
ADD COLUMN IF NOT EXISTS status_perkawinan text,
ADD COLUMN IF NOT EXISTS pekerjaan text,
ADD COLUMN IF NOT EXISTS hubungan_kk text,
ADD COLUMN IF NOT EXISTS rt text,
ADD COLUMN IF NOT EXISTS rw text,
ADD COLUMN IF NOT EXISTS kelurahan text,
ADD COLUMN IF NOT EXISTS kecamatan text,
ADD COLUMN IF NOT EXISTS kabupaten_kota text,
ADD COLUMN IF NOT EXISTS provinsi text;

-- Create function to validate only one kepala keluarga per KK
CREATE OR REPLACE FUNCTION public.validate_kepala_keluarga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if trying to set as Kepala Keluarga
  IF NEW.hubungan_kk = 'Kepala Keluarga' THEN
    -- Check if another Kepala Keluarga exists for this KK
    IF EXISTS (
      SELECT 1 FROM public.anggota 
      WHERE no_kk = NEW.no_kk 
      AND hubungan_kk = 'Kepala Keluarga'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Nomor KK % sudah memiliki Kepala Keluarga', NEW.no_kk;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_kepala_keluarga_trigger ON public.anggota;
CREATE TRIGGER validate_kepala_keluarga_trigger
BEFORE INSERT OR UPDATE ON public.anggota
FOR EACH ROW
EXECUTE FUNCTION public.validate_kepala_keluarga();