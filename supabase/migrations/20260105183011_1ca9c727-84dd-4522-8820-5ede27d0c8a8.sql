-- Drop the old RLS policy that uses wrong field (hubungan_kk)
DROP POLICY IF EXISTS "Penagih can view tagihan in wilayah" ON iuran_tagihan;

-- Create new RLS policy using correct field (status_dalam_kk)
CREATE POLICY "Penagih can view tagihan in wilayah" 
ON iuran_tagihan 
FOR SELECT 
USING (
  has_role(auth.uid(), 'penagih'::app_role) 
  AND EXISTS (
    SELECT 1
    FROM penagih_wilayah pw
    JOIN anggota a ON a.rt = pw.rt AND a.rw = pw.rw
    WHERE pw.penagih_user_id = auth.uid() 
      AND a.no_kk = iuran_tagihan.no_kk 
      AND a.status_dalam_kk = 'kepala_keluarga'
      AND a.rt IS NOT NULL 
      AND a.rw IS NOT NULL
  )
);