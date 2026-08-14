-- =========================================================
-- سندات القبض (Receipt Vouchers) — المرحلة الأولى
-- =========================================================

-- عداد تسلسلي لكل مستخدم: رقم السند يبدأ من 1 ويتزايد ذرياً.
CREATE TABLE public.receipt_sequences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  next_value bigint NOT NULL DEFAULT 1
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_sequences TO authenticated;
GRANT ALL ON public.receipt_sequences TO service_role;
ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receipt sequences" ON public.receipt_sequences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.next_receipt_serial(_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.receipt_sequences (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.receipt_sequences
    SET next_value = next_value + 1
    WHERE user_id = _user_id
    RETURNING next_value - 1 INTO v_next;
  RETURN v_next;
END;
$$;

-- جدول السندات
CREATE TABLE public.receipt_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  serial_number bigint NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  payment_tx_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  currency_id uuid NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  amount_words text NOT NULL,
  note text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, serial_number)
);

CREATE INDEX idx_receipts_user_date ON public.receipt_vouchers (user_id, issued_at DESC);
CREATE INDEX idx_receipts_person ON public.receipt_vouchers (person_id, issued_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_vouchers TO authenticated;
GRANT ALL ON public.receipt_vouchers TO service_role;
ALTER TABLE public.receipt_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receipts read" ON public.receipt_vouchers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own receipts insert" ON public.receipt_vouchers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own receipts update" ON public.receipt_vouchers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own receipts delete" ON public.receipt_vouchers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- توليد الرقم التسلسلي تلقائياً عند الإدراج
CREATE OR REPLACE FUNCTION public.assign_receipt_serial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.serial_number IS NULL THEN
    NEW.serial_number := public.next_receipt_serial(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_receipts_serial
  BEFORE INSERT ON public.receipt_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.assign_receipt_serial();
