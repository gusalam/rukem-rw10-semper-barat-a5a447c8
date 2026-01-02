-- Create a generic audit log trigger function
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_aksi text;
  v_record_id uuid;
  v_data_lama jsonb;
  v_data_baru jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_aksi := 'insert';
    v_record_id := NEW.id;
    v_data_lama := NULL;
    v_data_baru := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_aksi := 'update';
    v_record_id := NEW.id;
    v_data_lama := to_jsonb(OLD);
    v_data_baru := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_aksi := 'delete';
    v_record_id := OLD.id;
    v_data_lama := to_jsonb(OLD);
    v_data_baru := NULL;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.audit_log (user_id, aksi, tabel, record_id, data_lama, data_baru)
  VALUES (v_user_id, v_aksi, TG_TABLE_NAME, v_record_id, v_data_lama, v_data_baru);
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Audit log trigger for penagih table (status changes / deactivation)
CREATE TRIGGER audit_penagih_changes
AFTER INSERT OR UPDATE OR DELETE ON public.penagih
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Audit log trigger for kematian table
CREATE TRIGGER audit_kematian_changes
AFTER INSERT OR UPDATE OR DELETE ON public.kematian
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Audit log trigger for iuran_pembayaran (for verification actions)
CREATE TRIGGER audit_pembayaran_changes
AFTER INSERT OR UPDATE ON public.iuran_pembayaran
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Audit log trigger for santunan (for disbursement tracking)
CREATE TRIGGER audit_santunan_changes
AFTER INSERT OR UPDATE ON public.santunan
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Audit log trigger for penagih_wilayah (wilayah assignment changes)
CREATE TRIGGER audit_penagih_wilayah_changes
AFTER INSERT OR UPDATE OR DELETE ON public.penagih_wilayah
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Audit log trigger for kas (financial transactions)
CREATE TRIGGER audit_kas_changes
AFTER INSERT OR UPDATE OR DELETE ON public.kas
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();