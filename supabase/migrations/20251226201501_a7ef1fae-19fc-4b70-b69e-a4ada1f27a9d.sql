-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.format_cpf(cpf_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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