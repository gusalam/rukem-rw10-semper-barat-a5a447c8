-- Delete old anggota roles for users who now have penagih role
DELETE FROM public.user_roles 
WHERE id IN (
  SELECT ur.id 
  FROM public.user_roles ur
  WHERE ur.role = 'anggota'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2 
    WHERE ur2.user_id = ur.user_id 
    AND ur2.role = 'penagih'
  )
);

-- Add unique constraint to prevent duplicates in the future
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);