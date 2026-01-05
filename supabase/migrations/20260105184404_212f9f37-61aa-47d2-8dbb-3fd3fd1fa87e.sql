-- Buat trigger untuk validasi anti double payment
-- Mencegah insert pembayaran jika tagihan bukan status 'belum_bayar'

CREATE OR REPLACE FUNCTION public.validate_tagihan_before_pembayaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tagihan_status text;
BEGIN
  -- Get current tagihan status
  SELECT status::text INTO v_tagihan_status
  FROM public.iuran_tagihan
  WHERE id = NEW.tagihan_id;
  
  -- Check if tagihan exists
  IF v_tagihan_status IS NULL THEN
    RAISE EXCEPTION 'Tagihan tidak ditemukan';
  END IF;
  
  -- Only allow payment if status is 'belum_bayar'
  IF v_tagihan_status != 'belum_bayar' THEN
    RAISE EXCEPTION 'Tagihan sudah dibayar atau sedang menunggu verifikasi. Status: %', v_tagihan_status;
  END IF;
  
  -- Check if there's already a pending or approved payment for this tagihan
  IF EXISTS (
    SELECT 1 FROM public.iuran_pembayaran
    WHERE tagihan_id = NEW.tagihan_id
    AND status IN ('menunggu_admin', 'disetujui')
  ) THEN
    RAISE EXCEPTION 'Tagihan ini sudah memiliki pembayaran yang sedang diproses atau disetujui';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS validate_tagihan_before_pembayaran_trigger ON public.iuran_pembayaran;

-- Create the trigger
CREATE TRIGGER validate_tagihan_before_pembayaran_trigger
BEFORE INSERT ON public.iuran_pembayaran
FOR EACH ROW
EXECUTE FUNCTION public.validate_tagihan_before_pembayaran();