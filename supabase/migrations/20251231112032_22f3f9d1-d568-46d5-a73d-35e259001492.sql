-- =============================================
-- STEP 1: TAMBAH ROLE PENAGIH KE ENUM
-- =============================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'penagih';