-- Add RLS policy for Penagih to view anggota in their wilayah
CREATE POLICY "Penagih can view anggota in wilayah" 
ON public.anggota 
FOR SELECT 
USING (
  has_role(auth.uid(), 'penagih'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.penagih_wilayah pw
    WHERE pw.penagih_user_id = auth.uid()
      AND pw.rt = anggota.rt
      AND pw.rw = anggota.rw
  )
);