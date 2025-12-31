-- Fix search_path for functions
CREATE OR REPLACE FUNCTION public.check_single_approved_pembayaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.validate_penagih_wilayah()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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