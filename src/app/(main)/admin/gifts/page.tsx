"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHead } from "@/components/AccountUi";
import { COLLECTION_SELECT, Collection } from "@/lib/gifts";
import { fmtStars, starsError } from "@/lib/stars";

function Row({ c, onSaved }: { c: Collection; onSaved: () => void }) {
  const [price, setPrice] = useState(String(c.price));
  const [upg, setUpg] = useState(String(c.upgrade_price));
  const [delta, setDelta] = useState("");
  const [active, setActive] = useState(c.active);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("admin_gift_set", {
      p_collection: c.id,
      p_price: Number(price),
      p_upgrade_price: Number(upg),
      p_stock_delta: Number(delta || 0),
      p_active: active,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message.includes("bad_stock") ? "Сток не может быть меньше проданного" : starsError(error.message));
      return;
    }
    setDelta("");
    setMsg("Сохранено");
    onSaved();
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{c.name}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          В продаже
        </label>
      </div>
      <p className="text-xs text-muted">
        Тираж {fmtStars(c.supply)} · продано {fmtStars(c.sold)} · остаток {fmtStars(c.supply - c.sold)} · прокачано {fmtStars(c.upgraded)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" inputMode="numeric" placeholder="Цена" value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        <input className="input" inputMode="numeric" placeholder="Прокачка" value={upg}
          onChange={(e) => setUpg(e.target.value.replace(/\D/g, ""))} />
        <input className="input" inputMode="numeric" placeholder="± сток" value={delta}
          onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))} />
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <button onClick={save} disabled={busy || !price || !upg} className="btn-primary w-full py-2.5">
        {busy ? "Сохраняем..." : "Сохранить"}
      </button>
    </div>
  );
}

export default function AdminGiftsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("gift_collections").select(COLLECTION_SELECT).order("created_at");
    setCols((data ?? []) as unknown as Collection[]);
  }, []);

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => setAllowed(data === true));
  }, []);
  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (allowed === null) return <p className="py-16 text-center text-muted">Загрузка...</p>;
  if (!allowed) return <p className="py-16 text-center text-muted">Нет доступа.</p>;

  return (
    <div className="space-y-4">
      <PageHead title="Подарки" />
      <p className="text-sm text-muted">
        Новый подарок добавляется командой <code>npm run import-gift -- &quot;Название&quot;</code>, потом
        здесь выставляете цену, тираж и включаете продажу. Поле «± сток» добавляет к тиражу (можно с минусом).
      </p>
      {cols.length === 0 && <p className="py-8 text-center text-muted">Подарков ещё нет.</p>}
      {cols.map((c) => (
        <Row key={c.id} c={c} onSaved={load} />
      ))}
    </div>
  );
}