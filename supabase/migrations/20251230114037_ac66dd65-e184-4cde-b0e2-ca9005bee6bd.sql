-- Drop duplicate trigger
DROP TRIGGER IF EXISTS on_kematian_notify ON public.kematian;

-- Update function with correct Indonesian date format
CREATE OR REPLACE FUNCTION public.on_kematian_notify_all()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_anggota_nama TEXT;
  v_user_record RECORD;
  v_tanggal TEXT;
  v_bulan TEXT;
BEGIN
  -- Get the deceased member's name
  SELECT nama_lengkap INTO v_anggota_nama FROM public.anggota WHERE id = NEW.anggota_id;
  
  -- Format date in Indonesian
  v_bulan := CASE EXTRACT(MONTH FROM NEW.tanggal_meninggal)
    WHEN 1 THEN 'Januari'
    WHEN 2 THEN 'Februari'
    WHEN 3 THEN 'Maret'
    WHEN 4 THEN 'April'
    WHEN 5 THEN 'Mei'
    WHEN 6 THEN 'Juni'
    WHEN 7 THEN 'Juli'
    WHEN 8 THEN 'Agustus'
    WHEN 9 THEN 'September'
    WHEN 10 THEN 'Oktober'
    WHEN 11 THEN 'November'
    WHEN 12 THEN 'Desember'
  END;
  
  v_tanggal := EXTRACT(DAY FROM NEW.tanggal_meninggal) || ' ' || v_bulan || ' ' || EXTRACT(YEAR FROM NEW.tanggal_meninggal);
  
  -- Send notification to all active anggota with user_id
  FOR v_user_record IN 
    SELECT user_id FROM public.anggota 
    WHERE status = 'aktif' 
    AND user_id IS NOT NULL 
    AND id != NEW.anggota_id
  LOOP
    INSERT INTO public.notifikasi (user_id, judul, pesan)
    VALUES (
      v_user_record.user_id,
      'Berita Duka',
      'Telah meninggal dunia ' || v_anggota_nama || ' pada tanggal ' || v_tanggal || '. Semoga diberikan tempat terbaik di sisi-Nya. Santunan akan segera diproses.'
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;