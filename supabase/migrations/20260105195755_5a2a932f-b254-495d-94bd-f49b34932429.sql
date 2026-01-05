-- Ubah kolom penagih_user_id menjadi nullable
-- Agar data pembayaran tetap tersimpan saat penagih dihapus (untuk audit)
ALTER TABLE public.iuran_pembayaran 
ALTER COLUMN penagih_user_id DROP NOT NULL;