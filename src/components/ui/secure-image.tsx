import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SecureImageProps {
  bucketName: string;
  filePath: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function SecureImage({ 
  bucketName, 
  filePath, 
  alt, 
  className,
  fallbackClassName 
}: SecureImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadImage = async () => {
    if (!filePath) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      // Extract the file path from full URL if needed
      let path = filePath;
      
      // If it's a full URL, extract just the path
      if (filePath.includes('/storage/v1/object/')) {
        const match = filePath.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/);
        if (match) {
          path = match[1];
        }
      }

      // Create signed URL for private buckets
      const { data, error: signError } = await supabase
        .storage
        .from(bucketName)
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (signError) {
        console.error('Error creating signed URL:', signError);
        // Try public URL as fallback
        const { data: publicData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(path);
        
        if (publicData?.publicUrl) {
          setImageUrl(publicData.publicUrl);
        } else {
          setError(true);
        }
      } else if (data?.signedUrl) {
        setImageUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error loading image:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImage();
  }, [filePath, bucketName]);

  if (loading) {
    return (
      <Skeleton className={cn("w-full h-48", fallbackClassName)} />
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 bg-muted rounded-lg border border-dashed",
        fallbackClassName
      )}>
        <ImageOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Gambar tidak tersedia</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadImage}
          className="mt-1"
        >
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Muat Ulang
        </Button>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={cn("w-full max-h-64 object-contain bg-muted rounded-lg", className)}
      onError={() => setError(true)}
    />
  );
}
