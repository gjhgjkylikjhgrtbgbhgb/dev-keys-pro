
-- Add parent_id to profiles for hierarchy
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.profiles(id);

-- Ensure correct permissions for profiles table
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Improved increment_credits RPC with security definer
CREATE OR REPLACE FUNCTION public.increment_credits(
  row_id UUID,
  amount INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET credits = COALESCE(credits, 0) + amount 
  WHERE id = row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_credits TO authenticated;

-- Function to handle sub-admin credit transfer logic safely
CREATE OR REPLACE FUNCTION public.transfer_credits_safe(
  sender_id UUID,
  receiver_id UUID,
  transfer_amount INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_credits INT;
  is_master BOOLEAN;
  master_phone TEXT := '11921009176';
BEGIN
  -- Check if sender is master
  SELECT (phone = master_phone OR phone = '+55' || master_phone) INTO is_master 
  FROM public.profiles WHERE id = sender_id;

  -- If not master, check balance
  IF NOT COALESCE(is_master, false) THEN
    SELECT COALESCE(credits, 0) INTO sender_credits FROM public.profiles WHERE id = sender_id;
    
    IF sender_credits < transfer_amount THEN
      RAISE EXCEPTION 'Saldo de créditos insuficiente!';
    END IF;

    -- Deduct from sender if not master
    UPDATE public.profiles SET credits = credits - transfer_amount WHERE id = sender_id;
  END IF;

  -- Add to receiver
  UPDATE public.profiles SET credits = COALESCE(credits, 0) + transfer_amount WHERE id = receiver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_credits_safe TO authenticated;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
