-- =========================================================
-- خطط السداد (Payment Plans) — المرحلة الثانية
-- جدولة دين إلى أقساط مرتبطة بـ payment_promises لمتابعتها تلقائياً
-- في صندوق اليوم ولوحة المتابعة.
-- =========================================================

CREATE TABLE public.payment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  installments_count integer NOT NULL CHECK (installments_count BETWEEN 2 AND 24),
  installment_amount numeric NOT NULL CHECK (installment_amount > 0),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly')),
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plans_user ON public.payment_plans (user_id, created_at DESC);
CREATE INDEX idx_plans_person ON public.payment_plans (person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plans" ON public.payment_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_plans_touch BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ربط أقساط الخطة بصفوف الوعود (كل قسط = وعد مستقل)
ALTER TABLE public.payment_promises ADD COLUMN IF NOT EXISTS plan_id uuid
  REFERENCES public.payment_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_promises_plan ON public.payment_promises (plan_id);
