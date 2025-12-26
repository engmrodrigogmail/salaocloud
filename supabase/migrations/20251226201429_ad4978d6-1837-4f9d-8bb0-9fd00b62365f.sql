-- Add CPF column to clients table
ALTER TABLE public.clients 
ADD COLUMN cpf TEXT;

-- Add unique constraint for CPF per establishment
CREATE UNIQUE INDEX idx_clients_cpf_establishment 
ON public.clients(cpf, establishment_id) 
WHERE cpf IS NOT NULL;

-- Add menu/catalog visibility setting to establishments
ALTER TABLE public.establishments 
ADD COLUMN show_catalog BOOLEAN NOT NULL DEFAULT false;

-- Create a function to format CPF
CREATE OR REPLACE FUNCTION public.format_cpf(cpf_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove all non-numeric characters
  cpf_raw := regexp_replace(cpf_raw, '[^0-9]', '', 'g');
  
  -- Return formatted if valid length
  IF length(cpf_raw) = 11 THEN
    RETURN substring(cpf_raw, 1, 3) || '.' || 
           substring(cpf_raw, 4, 3) || '.' || 
           substring(cpf_raw, 7, 3) || '-' || 
           substring(cpf_raw, 10, 2);
  END IF;
  
  RETURN cpf_raw;
END;
$$;