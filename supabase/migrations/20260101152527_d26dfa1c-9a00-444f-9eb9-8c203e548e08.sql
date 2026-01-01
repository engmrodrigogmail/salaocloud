-- Create storage bucket for professional avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-avatars', 'professional-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to professional avatars
CREATE POLICY "Public can view professional avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'professional-avatars');

-- Allow authenticated users to upload professional avatars
CREATE POLICY "Authenticated users can upload professional avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'professional-avatars' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their professional avatars
CREATE POLICY "Authenticated users can update professional avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'professional-avatars' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete professional avatars
CREATE POLICY "Authenticated users can delete professional avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'professional-avatars' AND auth.role() = 'authenticated');