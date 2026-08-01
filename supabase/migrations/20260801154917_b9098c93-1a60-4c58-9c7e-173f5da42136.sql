CREATE TABLE public.payment_promises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  promised_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  note text,
  kept_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_promises TO authenticated;
GRANT ALL ON public.payment_promises TO service_role;
ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own promises" ON public.payment_promises FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_promises_user_status ON public.payment_promises (user_id, status, promised_date);
CREATE INDEX idx_promises_person ON public.payment_promises (person_id);

CREATE TRIGGER trg_promises_touch BEFORE UPDATE ON public.payment_promises
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  payment_tx_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  debt_tx_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own allocations" ON public.payment_allocations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_alloc_payment ON public.payment_allocations (payment_tx_id);
CREATE INDEX idx_alloc_debt ON public.payment_allocations (debt_tx_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_promises;