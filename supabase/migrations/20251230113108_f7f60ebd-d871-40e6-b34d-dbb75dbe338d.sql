-- Create trigger to notify all members when a death is recorded
CREATE TRIGGER on_kematian_insert_notify
AFTER INSERT ON public.kematian
FOR EACH ROW
EXECUTE FUNCTION public.on_kematian_notify_all();