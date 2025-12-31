-- Add no_kk column to iuran table for per-KK iuran system
ALTER TABLE public.iuran ADD COLUMN no_kk TEXT;

-- Create index for efficient KK-based queries
CREATE INDEX idx_iuran_no_kk ON public.iuran(no_kk);

-- Add comment for documentation
COMMENT ON COLUMN public.iuran.no_kk IS 'Nomor KK untuk sistem iuran per keluarga';