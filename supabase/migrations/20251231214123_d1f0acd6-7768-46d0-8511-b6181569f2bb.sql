-- Drop old tables that are no longer used
-- First drop pembayaran_iuran (depends on iuran)
DROP TABLE IF EXISTS public.pembayaran_iuran;

-- Then drop iuran table
DROP TABLE IF EXISTS public.iuran;