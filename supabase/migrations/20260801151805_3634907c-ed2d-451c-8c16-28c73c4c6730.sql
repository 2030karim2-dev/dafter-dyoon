-- =========================================================
-- 1) MESSAGE TEMPLATES
-- =========================================================
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own message templates" ON public.message_templates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_message_templates_updated
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 2) FOLLOWUP POLICIES (one row per user)
-- =========================================================
CREATE TABLE public.followup_policies (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  days_before integer NOT NULL DEFAULT 3,
  overdue_every_days integer NOT NULL DEFAULT 7,
  max_reminders integer NOT NULL DEFAULT 5,
  quiet_start integer NOT NULL DEFAULT 21,
  quiet_end integer NOT NULL DEFAULT 8,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  auto_send boolean NOT NULL DEFAULT false,
  daily_digest boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_policies TO authenticated;
GRANT ALL ON public.followup_policies TO service_role;
ALTER TABLE public.followup_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own followup policy" ON public.followup_policies
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_followup_policies_updated
  BEFORE UPDATE ON public.followup_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 3) CHANNEL SETTINGS (one row per user)
-- =========================================================
CREATE TABLE public.channel_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  whatsapp_auto boolean NOT NULL DEFAULT false,
  whatsapp_from text,
  telegram_enabled boolean NOT NULL DEFAULT false,
  telegram_chat_id text,
  telegram_link_code text,
  sms_enabled boolean NOT NULL DEFAULT false,
  sms_from text,
  signature_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX channel_settings_link_code_key
  ON public.channel_settings (telegram_link_code)
  WHERE telegram_link_code IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_settings TO authenticated;
GRANT ALL ON public.channel_settings TO service_role;
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own channel settings" ON public.channel_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_channel_settings_updated
  BEFORE UPDATE ON public.channel_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4) OUTBOX
-- =========================================================
CREATE TABLE public.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  kind text NOT NULL DEFAULT 'reminder',
  body text NOT NULL,
  destination text,
  status text NOT NULL DEFAULT 'queued',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX outbox_dedupe_key_idx ON public.outbox (user_id, dedupe_key);
CREATE INDEX outbox_status_sched_idx ON public.outbox (user_id, status, scheduled_at);
CREATE INDEX outbox_person_idx ON public.outbox (person_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbox TO authenticated;
GRANT ALL ON public.outbox TO service_role;
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outbox" ON public.outbox
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_outbox_updated
  BEFORE UPDATE ON public.outbox
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 5) MESSAGE LOG
-- =========================================================
CREATE TABLE public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  outbox_id uuid,
  channel text NOT NULL,
  kind text NOT NULL,
  body text NOT NULL,
  destination text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_log_person_idx ON public.message_log (person_id, sent_at DESC);
CREATE INDEX message_log_user_idx ON public.message_log (user_id, sent_at DESC);

GRANT SELECT, INSERT ON public.message_log TO authenticated;
GRANT ALL ON public.message_log TO service_role;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own message log read" ON public.message_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own message log insert" ON public.message_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 6) SEED defaults for new users (extend existing seeder)
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_followup_defaults(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.followup_policies (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.channel_settings (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.message_templates (user_id, kind, title, body) VALUES
    (_user_id, 'upcoming', 'تذكير قبل الاستحقاق',
     'السلام عليكم {{name}}،' || chr(10) ||
     'نودّ تذكيركم بأن لديكم مبلغاً مستحقاً بقيمة {{amount}} {{currency}} بتاريخ {{due_date}}.' || chr(10) ||
     'نشكر لكم حسن التعامل.' || chr(10) || chr(10) || '{{signature}}'),
    (_user_id, 'due_today', 'استحقاق اليوم',
     'السلام عليكم {{name}}،' || chr(10) ||
     'يحل اليوم موعد استحقاق مبلغ {{amount}} {{currency}}.' || chr(10) ||
     'نرجو التكرم بالسداد، وشكراً لتعاونكم.' || chr(10) || chr(10) || '{{signature}}'),
    (_user_id, 'overdue', 'تذكير بمبلغ متأخر',
     'السلام عليكم {{name}}،' || chr(10) ||
     'نفيدكم بأن المبلغ المستحق {{amount}} {{currency}} متأخر عن موعده منذ {{days_late}} يوماً.' || chr(10) ||
     'نرجو المبادرة بالسداد أو التواصل معنا لترتيب الأمر.' || chr(10) || chr(10) || '{{signature}}'),
    (_user_id, 'statement', 'إرسال كشف حساب',
     'السلام عليكم {{name}}،' || chr(10) ||
     'مرفق كشف حسابكم حتى تاريخ {{today}}.' || chr(10) ||
     'الرصيد الحالي: {{balance}} {{currency}}.' || chr(10) ||
     'نرجو مراجعته وإفادتنا بأي ملاحظة.' || chr(10) || chr(10) || '{{signature}}'),
    (_user_id, 'thanks', 'شكر بعد السداد',
     'السلام عليكم {{name}}،' || chr(10) ||
     'نشكر لكم سداد مبلغ {{amount}} {{currency}}. تم تحديث حسابكم لدينا.' || chr(10) ||
     'نتشرف بخدمتكم دائماً.' || chr(10) || chr(10) || '{{signature}}')
  ON CONFLICT (user_id, kind) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  PERFORM public.seed_followup_defaults(NEW.id);
  RETURN NEW;
END;
$$;

-- Backfill existing users
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_followup_defaults(u.id);
  END LOOP;
END $$;