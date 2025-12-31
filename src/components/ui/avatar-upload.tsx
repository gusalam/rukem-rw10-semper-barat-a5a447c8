import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Camera, X, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function AvatarUpload({
  value,
  onChange,
  disabled = false,
  className,
  name = '',
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'File harus berupa gambar',
      });
      return;
    }

    // Validate file size (max 2MB for avatars)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ukuran foto maksimal 2MB',
      });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast({
        title: 'Berhasil',
        description: 'Foto profil berhasil diunggah',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      setPreview(value || null);
      toast({
        variant: 'destructive',
        title: 'Gagal Upload',
        description: error.message || 'Terjadi kesalahan saat upload',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }, [onChange, toast, value]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onChange]);

  // Sync preview with external value changes
  if (value !== preview && !uploading) {
    setPreview(value || null);
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      <div className="relative group">
        <Avatar className="w-24 h-24 border-2 border-border">
          <AvatarImage src={preview || undefined} alt={name} />
          <AvatarFallback className="bg-muted text-muted-foreground text-xl">
            {name ? getInitials(name) : <User className="h-10 w-10" />}
          </AvatarFallback>
        </Avatar>
        
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!disabled && !uploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
      </div>

      {preview && !disabled && !uploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4 mr-1" />
          Hapus Foto
        </Button>
      )}

      {!preview && !uploading && (
        <p className="text-xs text-muted-foreground text-center">
          Klik ikon kamera untuk upload foto
        </p>
      )}
    </div>
  );
}
