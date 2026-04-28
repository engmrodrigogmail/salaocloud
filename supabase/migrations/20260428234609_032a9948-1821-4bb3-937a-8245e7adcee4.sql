-- Add unique constraints on category names per establishment to prevent duplicates
ALTER TABLE public.service_categories
  ADD CONSTRAINT service_categories_estab_name_unique UNIQUE (establishment_id, name);

ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_estab_name_unique UNIQUE (establishment_id, name);

-- Helper function to keep products.category text in sync when a product_category is renamed
CREATE OR REPLACE FUNCTION public.sync_product_category_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.products
       SET category = NEW.name, updated_at = now()
     WHERE establishment_id = NEW.establishment_id
       AND category = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_category_rename ON public.product_categories;
CREATE TRIGGER trg_sync_product_category_rename
AFTER UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.sync_product_category_rename();

-- When a product_category is deleted, clear products.category referencing it (don't delete products)
CREATE OR REPLACE FUNCTION public.clear_product_category_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
     SET category = NULL, updated_at = now()
   WHERE establishment_id = OLD.establishment_id
     AND category = OLD.name;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_product_category_on_delete ON public.product_categories;
CREATE TRIGGER trg_clear_product_category_on_delete
BEFORE DELETE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.clear_product_category_on_delete();