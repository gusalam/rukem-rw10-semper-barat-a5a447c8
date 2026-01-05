-- Perbaiki FK audit_log.user_id agar penghapusan auth user tidak gagal
-- Saat user dihapus, audit_log tetap tersimpan (user_id di-null-kan)

-- Pastikan kolom nullable (aman walau sudah)
ALTER TABLE public.audit_log
  ALTER COLUMN user_id DROP NOT NULL;

-- Ganti FK menjadi ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_log_user_id_fkey'
  ) THEN
    ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;