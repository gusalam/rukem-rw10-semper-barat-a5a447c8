-- Add status_aktif column to penagih tracking
-- We'll track penagih status in a new table to keep it separate from roles

CREATE TABLE IF NOT EXISTS public.penagih (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nama_lengkap text NOT NULL,
  email text,
  status_aktif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.penagih ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin can manage penagih" ON public.penagih
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Penagih can view own data" ON public.penagih
FOR SELECT USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_penagih_updated_at
BEFORE UPDATE ON public.penagih
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();