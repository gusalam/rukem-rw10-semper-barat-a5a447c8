-- 1) Prevent duplicate kematian per anggota
ALTER TABLE public.kematian
  ADD CONSTRAINT kematian_anggota_unique UNIQUE (anggota_id);

-- 2) Ensure only one santunan row per kematian
ALTER TABLE public.santunan
  ADD CONSTRAINT santunan_kematian_unique UNIQUE (kematian_id);

-- 3) Fix trigger function to use current schema (iuran_tagihan) instead of legacy table (iuran)
CREATE OR REPLACE FUNCTION public.on_kematian_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_no_kk TEXT;
  v_tunggakan BIGINT;
  v_nominal_santunan BIGINT;
  v_nominal_akhir BIGINT;
  v_status_tagihan_terakhir TEXT;
BEGIN
  -- Resolve KK
  SELECT a.no_kk INTO v_no_kk
  FROM public.anggota a
  WHERE a.id = NEW.anggota_id;

  -- Get nominal santunan from pengaturan
  SELECT p.nominal_santunan INTO v_nominal_santunan
  FROM public.pengaturan p
  LIMIT 1;

  -- Calculate total tunggakan (unpaid tagihan) per KK
  SELECT COALESCE(SUM(t.nominal), 0) INTO v_tunggakan
  FROM public.iuran_tagihan t
  WHERE t.no_kk = v_no_kk
    AND t.status IN ('belum_bayar', 'menunggu_admin');

  -- Latest tagihan status (for info field)
  SELECT t.status::text INTO v_status_tagihan_terakhir
  FROM public.iuran_tagihan t
  WHERE t.no_kk = v_no_kk
  ORDER BY t.periode DESC
  LIMIT 1;

  -- Calculate final santunan amount
  v_nominal_akhir := GREATEST(COALESCE(v_nominal_santunan, 0) - COALESCE(v_tunggakan, 0), 0);

  -- Update kematian with tunggakan info
  UPDATE public.kematian
  SET tunggakan_total = COALESCE(v_tunggakan, 0),
      status_iuran_terakhir = v_status_tagihan_terakhir
  WHERE id = NEW.id;

  -- Auto-create / upsert santunan record
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
    COALESCE(v_nominal_santunan, 0),
    COALESCE(v_tunggakan, 0),
    v_nominal_akhir,
    'pending'
  )
  ON CONFLICT (kematian_id)
  DO UPDATE SET
    anggota_id = EXCLUDED.anggota_id,
    nominal_dasar = EXCLUDED.nominal_dasar,
    potongan_tunggakan = EXCLUDED.potongan_tunggakan,
    nominal_akhir = EXCLUDED.nominal_akhir,
    updated_at = now();

  -- Update anggota status to meninggal
  UPDATE public.anggota
  SET status = 'meninggal',
      updated_at = now()
  WHERE id = NEW.anggota_id;

  RETURN NEW;
END;
$$;