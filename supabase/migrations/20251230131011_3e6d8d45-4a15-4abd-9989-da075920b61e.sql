-- Create storage bucket for QRIS images
INSERT INTO storage.buckets (id, name, public)
VALUES ('qris', 'qris', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "QRIS images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'qris');

-- Allow authenticated admins to upload
CREATE POLICY "Admins can upload QRIS images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'qris' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow authenticated admins to update
CREATE POLICY "Admins can update QRIS images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'qris' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow authenticated admins to delete
CREATE POLICY "Admins can delete QRIS images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'qris' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);