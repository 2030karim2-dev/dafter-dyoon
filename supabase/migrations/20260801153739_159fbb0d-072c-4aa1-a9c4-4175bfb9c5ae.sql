-- 1) Remove exchange-rate machinery entirely
DROP TABLE IF EXISTS public.exchange_rates CASCADE;
ALTER TABLE public.currencies DROP COLUMN IF EXISTS rate;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS rate_at_tx;

-- 2) Default currencies: SAR + YER only
CREATE OR REPLACE FUNCTION public.seed_default_currencies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.currencies (user_id, name, symbol, is_base) VALUES
    (NEW.id, 'ريال سعودي', 'ر.س', true),
    (NEW.id, 'ريال يمني',  'ر.ي', false);
  RETURN NEW;
END;
$$;

-- backfill missing default currencies for existing users
INSERT INTO public.currencies (user_id, name, symbol, is_base)
SELECT p.user_id, d.name, d.symbol, d.is_base
FROM (SELECT DISTINCT user_id FROM public.profiles) p
CROSS JOIN (VALUES ('ريال سعودي','ر.س',true), ('ريال يمني','ر.ي',false)) AS d(name, symbol, is_base)
WHERE NOT EXISTS (
  SELECT 1 FROM public.currencies c WHERE c.user_id = p.user_id AND c.name = d.name
);

-- 3) person_accounts: one independent account per person per currency
CREATE TABLE IF NOT EXISTS public.person_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, currency_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_accounts TO authenticated;
GRANT ALL ON public.person_accounts TO service_role;

ALTER TABLE public.person_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own person accounts"
ON public.person_accounts FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS person_accounts_user_person_idx
  ON public.person_accounts (user_id, person_id);

CREATE TRIGGER person_accounts_touch
BEFORE UPDATE ON public.person_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- open an account for every currency of the owner when a person is created
CREATE OR REPLACE FUNCTION public.open_accounts_for_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.person_accounts (user_id, person_id, currency_id)
  SELECT NEW.user_id, NEW.id, c.id
  FROM public.currencies c
  WHERE c.user_id = NEW.user_id
  ON CONFLICT (person_id, currency_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER people_open_accounts
AFTER INSERT ON public.people
FOR EACH ROW EXECUTE FUNCTION public.open_accounts_for_person();

-- open an account for every existing person when a currency is created
CREATE OR REPLACE FUNCTION public.open_accounts_for_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.person_accounts (user_id, person_id, currency_id)
  SELECT NEW.user_id, p.id, NEW.id
  FROM public.people p
  WHERE p.user_id = NEW.user_id
  ON CONFLICT (person_id, currency_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER currencies_open_accounts
AFTER INSERT ON public.currencies
FOR EACH ROW EXECUTE FUNCTION public.open_accounts_for_currency();

-- backfill accounts for existing people
INSERT INTO public.person_accounts (user_id, person_id, currency_id)
SELECT p.user_id, p.id, c.id
FROM public.people p
JOIN public.currencies c ON c.user_id = p.user_id
ON CONFLICT (person_id, currency_id) DO NOTHING;

-- 4) Realtime for the "one body" sync layer
ALTER TABLE public.people REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.reminders REPLICA IDENTITY FULL;
ALTER TABLE public.outbox REPLICA IDENTITY FULL;
ALTER TABLE public.person_accounts REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.people; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.outbox; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.person_accounts; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;