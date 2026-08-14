-- =========================================================
-- المحافظ الإلكترونية اليمنية (Wallet Accounts) — المرحلة الثالثة
-- الإدخال اليدوي: أرقام حسابات المستخدم في كل محفظة لاستقبال السداد.
-- =========================================================

CREATE TABLE public.wallet_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gib','shiln','floosk','geel','amwal')),
  account_number text NOT NULL,
  holder_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX idx_wallet_accounts_user ON public.wallet_accounts (user_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_accounts TO authenticated;
GRANT ALL ON public.wallet_accounts TO service_role;
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet accounts" ON public.wallet_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_wallet_accounts_touch BEFORE UPDATE ON public.wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
