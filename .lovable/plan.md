# خطة تقسيم الملفات وإعادة الهيكلة الاحترافية

الهدف: لا يزيد أي ملف عن ~120 سطر، وكل ملف له مسؤولية واحدة واضحة (عرض / منطق / بيانات).

## القاعدة المعمارية الموحّدة

```text
routes/*.tsx          → تجميع فقط (loader + hooks + JSX قصير)
features/<domain>/     → مكونات العرض الصغيرة (presentational)
features/<domain>/hooks → منطق الحالة والاستدعاءات
lib/<domain>.functions  → الواجهة الخلفية (server functions)
lib/<domain>/*.ts       → منطق حسابي نقي قابل للاختبار
```

## المرحلة 1 — أكبر ملفات التصدير (المخرجات الأهم للعميل)

- `lib/io/exportExcel.ts` (390) → `excel/theme.ts` (ألوان/تنسيقات الأرقام)، `excel/header.ts` (هيدر الشركة)، `excel/statement.ts` (كشف حساب لكل عملة)، `excel/tables.ts` (المعاملات/المصاريف)، و`exportExcel.ts` كواجهة تصدير فقط.
- `lib/io/exportPdf.ts` (353) → `pdf/template.ts` (HTML للكشف)، `pdf/render.ts` (html2canvas + jsPDF)، `pdf/index.ts` واجهة.

## المرحلة 2 — صفحات كبيرة → مكونات صغيرة

- `routes/app.followup.tsx` (334) → `features/followup/`: `FollowupFilters`, `FollowupCard`, `FollowupList`, `FollowupStats` + `useFollowup()` للمنطق، ونقل حساب درجة الخطورة إلى `lib/followup/severity.ts`.
- `routes/app.person.$id.tsx` (290) → `features/debts/person/`: `PersonHeaderCard`, `PersonStatementActions` (واتساب/اكسل/PDF)، `usePersonDetail()`؛ وبناء نص رسالة الواتساب في `lib/messaging/statementMessage.ts`.
- `routes/app.index.tsx` (264) → `features/home/`: `HomeTotalsGrid`, `HomePeopleSection`, `useHomeData()`.
- `routes/app.reports.tsx` + `app.opening-balances.tsx` + `app.expenses.tsx` → نفس النمط: رأس + جدول + شريط أدوات، والمنطق في hook.

## المرحلة 3 — الحوارات الضخمة

- `AddTransactionDialog.tsx` (306) → `features/debts/add/`: `PersonPicker`, `DirectionToggle`, `AmountCurrencyRow`, `DueDateRow` + `useAddTransaction()`.
- `ExpenseDialog.tsx` (215) → `features/expenses/dialog/`: `CategoryPicker`, `ReceiptUploader`, `useExpenseForm()`.
- `OpeningBalanceImportDialog.tsx` (217) → خطوات مستقلة `Step1Pick`, `Step2AiReview`, `Step3Commit` + `useOpeningImport()`.
- `CustomerAttachments.tsx` (275) → `AttachmentUploader`, `AttachmentRow`, `AttachmentGrid` + `useAttachments()`.

## المرحلة 4 — تنظيف المنطق المشترك

- `PinLockGate.tsx` (188) → `usePinLock()` (القفل/المهل/المحاولات) + `PinKeypad` عرض فقط.
- `OnboardingFlow.tsx` (187) → خطوات منفصلة + `useOnboarding()`.
- `jobs.functions.ts` / `cron/process.ts` → نقل المنطق إلى `lib/jobs/*.server.ts` وترك الملفات كأغلفة رقيقة (شرط سلامة الـ code splitting).
- `settings.data.tsx` / `settings.security.tsx` → مجموعات إعدادات صغيرة تحت `features/settings/`.

## ملاحظات تقنية

- ملفات `*.functions.ts` تبقى أغلفة رقيقة: لا ثوابت ولا دوال مساعدة في نطاق الوحدة (تُحذف عند التقسيم وتسبب ReferenceError).
- إعادة الهيكلة بدون تغيير أي سلوك أو تصميم — نفس الواجهة والألوان والأحجام (Micro-UI v2).
- بعد كل مرحلة: فحص الأنواع والتنقل بين الصفحات للتأكد من عدم وجود انكسار.
