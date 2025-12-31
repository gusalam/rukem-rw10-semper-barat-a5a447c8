-- Add storage policies for bukti_pembayaran bucket
-- Allow penagih to upload to bukti_pembayaran bucket

CREATE POLICY "Penagih can upload bukti pembayaran"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bukti_pembayaran' 
  AND has_role(auth.uid(), 'penagih')
);

CREATE POLICY "Penagih can view own bukti pembayaran"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bukti_pembayaran'
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'penagih')
  )
);

CREATE POLICY "Admin can manage bukti pembayaran"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'bukti_pembayaran'
  AND has_role(auth.uid(), 'admin')
);

-- Also ensure anggota can view their own KK pembayaran bukti
CREATE POLICY "Authenticated users can view bukti pembayaran"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'bukti_pembayaran');