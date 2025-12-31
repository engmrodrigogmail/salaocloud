-- Add INSERT policy for broadcast_logs table
CREATE POLICY "Establishments can create campaign logs" 
ON public.broadcast_logs 
FOR INSERT 
WITH CHECK (
  campaign_id IN (
    SELECT id FROM broadcast_campaigns 
    WHERE establishment_id = get_user_establishment_id(auth.uid())
  )
);

-- Add UPDATE policy for broadcast_logs table (needed for updating status)
CREATE POLICY "Establishments can update their campaign logs" 
ON public.broadcast_logs 
FOR UPDATE 
USING (
  campaign_id IN (
    SELECT id FROM broadcast_campaigns 
    WHERE establishment_id = get_user_establishment_id(auth.uid())
  )
);