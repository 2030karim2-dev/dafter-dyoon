import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Star, StarOff, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/currencies")({ component: CurrenciesPage });

interface Currency { id: string; name: string; symbol: string; is_base: boolean }

function CurrenciesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [rate, setRate] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("currencies").select("*").order("is_base", { ascending: false }).order("created_at");
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("أدخل اسم العملة"); return; }
    const r = parseFloat(rate);
    if (!r || r <= 0) { toast.error("سعر التحويل غير صحيح"); return; }
    setBusy(true);
    const { error } = await supabase.from("currencies").insert({
      user_id: user.id, name: name.trim(), symbol: symbol.trim(), rate: r, is_base: false,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(""); setSymbol(""); setRate("1");
    toast.success("تمت إضافة العملة");
    load();
  };

  const del = async (id: string, isBase: boolean) => {
    if (isBase) { toast.error("لا يمكن حذف العملة الأساسية"); return; }
    if (!confirm("حذف العملة؟ لن يتم الحذف إذا كانت مستخدمة في معاملات.")) return;
    const { error } = await supabase.from("currencies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  const setBase = async (id: string) => {
    if (!user) return;
    await supabase.from("currencies").update({ is_base: false }).eq("user_id", user.id);
    await supabase.from("currencies").update({ is_base: true, rate: 1 }).eq("id", id);
    toast.success("تم تعيين العملة الأساسية");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Coins className="size-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">العملات</h1>
          <p className="text-xs text-muted-foreground">حدّد عملتك الأساسية وأسعار التحويل</p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">إضافة عملة جديدة</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">اسم العملة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: يورو" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">الرمز</Label>
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="€" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">سعر التحويل للأساسية</Label>
            <Input type="number" inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        </div>
        <Button onClick={add} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
          <Plus className="size-4" /> إضافة
        </Button>
      </Card>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="bg-card border rounded-2xl p-3 shadow-card flex items-center gap-3">
              <button onClick={() => !c.is_base && setBase(c.id)} className={`size-10 rounded-xl flex items-center justify-center transition-colors ${c.is_base ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-primary"}`} aria-label="تعيين كأساسية">
                {c.is_base ? <Star className="size-4 fill-current" /> : <StarOff className="size-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {c.name} {c.symbol && <span className="text-xs text-muted-foreground">{c.symbol}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.is_base ? "العملة الأساسية" : `1 ${c.name} = ${c.rate} أساسي`}
                </div>
              </div>
              {!c.is_base && (
                <button onClick={() => del(c.id, c.is_base)} className="text-muted-foreground hover:text-danger p-2">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
