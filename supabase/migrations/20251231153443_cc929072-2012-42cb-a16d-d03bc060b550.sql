-- Create storage bucket for broadcast images
INSERT INTO storage.buckets (id, name, public)
VALUES ('broadcast-images', 'broadcast-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for establishments to upload images
CREATE POLICY "Establishments can upload broadcast images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'broadcast-images' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for anyone to view broadcast images (public bucket)
CREATE POLICY "Anyone can view broadcast images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'broadcast-images');

-- Create policy for establishments to delete their own images
CREATE POLICY "Establishments can delete their own broadcast images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'broadcast-images' 
  AND auth.uid() IS NOT NULL
);