-- Create function to send notifications to all active anggota when kematian is inserted
CREATE OR REPLACE FUNCTION public.on_kematian_notify_all()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anggota_nama TEXT;
  v_user_record RECORD;
BEGIN
  -- Get the deceased member's name
  SELECT nama_lengkap INTO v_anggota_nama FROM public.anggota WHERE id = NEW.anggota_id;
  
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
      'Telah meninggal dunia ' || v_anggota_nama || ' pada tanggal ' || to_char(NEW.tanggal_meninggal, 'DD MMMM YYYY') || '. Semoga diberikan tempat terbaik di sisi-Nya.'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for kematian notifications
DROP TRIGGER IF EXISTS on_kematian_notify ON public.kematian;
CREATE TRIGGER on_kematian_notify
AFTER INSERT ON public.kematian
FOR EACH ROW
EXECUTE FUNCTION public.on_kematian_notify_all();