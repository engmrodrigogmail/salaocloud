-- Create storage bucket for establishment logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('establishment-logos', 'establishment-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public can view establishment logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'establishment-logos');

-- Create policy for establishment owners to upload
CREATE POLICY "Establishment owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'establishment-logos' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for establishment owners to update their logos
CREATE POLICY "Establishment owners can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'establishment-logos' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for establishment owners to delete their logos
CREATE POLICY "Establishment owners can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'establishment-logos' 
  AND auth.uid() IS NOT NULL
);