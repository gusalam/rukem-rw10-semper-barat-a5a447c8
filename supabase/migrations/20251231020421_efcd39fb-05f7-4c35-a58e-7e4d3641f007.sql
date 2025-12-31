-- Create a security definer function to get no_kk of current user's anggota
CREATE OR REPLACE FUNCTION public.get_anggota_no_kk(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT no_kk FROM public.anggota WHERE user_id = _user_id LIMIT 1;
$$;

-- Add policy to allow anggota to view other members in the same KK
CREATE POLICY "Anggota can view same KK members"
ON public.anggota
FOR SELECT
USING (
  no_kk = get_anggota_no_kk(auth.uid())
);