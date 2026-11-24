"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHead } from "@/components/AccountUi";
import GiftArt from "@/components/GiftArt";
import {
  COLLECTION_SELECT,
  Collection,
  GiftBackdrop,
  GiftModel,
  GiftPattern,
} from "@/lib/gifts";
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
      setMsg(
        error.message.includes("bad_stock")
          ? "Сток не может быть меньше проданного"
          : starsError(error.message)
      );
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
        Тираж {fmtStars(c.supply)} · продано {fmtStars(c.sold)} · остаток{" "}
        {fmtStars(c.supply - c.sold)} · прокачано {fmtStars(c.upgraded)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <input
          className="input"
          inputMode="numeric"
          placeholder="Цена"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
        />
        <input
          className="input"
          inputMode="numeric"
          placeholder="Прокачка"
          value={upg}
          onChange={(e) => setUpg(e.target.value.replace(/\D/g, ""))}
        />
        <input
          className="input"
          inputMode="numeric"
          placeholder="± сток"
          value={delta}
          onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))}
        />
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <button onClick={save} disabled={busy || !price || !upg} className="btn-primary w-full py-2.5">
        {busy ? "Сохраняем..." : "Сохранить"}
      </button>
    </div>
  );
}

function GiveGift({ cols }: { cols: Collection[] }) {
  const [username, setUsername] = useState("");
  const [colId, setColId] = useState("");
  const [upgraded, setUpgraded] = useState(true);
  const [models, setModels] = useState<GiftModel[]>([]);
  const [backdrops, setBackdrops] = useState<GiftBackdrop[]>([]);
  const [patterns, setPatterns] = useState<GiftPattern[]>([]);
  const [modelId, setModelId] = useState("");
  const [backId, setBackId] = useState("");
  const [patId, setPatId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const cid = colId || cols[0]?.id || "";
  const col = cols.find((c) => c.id === cid) ?? null;

  useEffect(() => {
    Promise.all([
      supabase
        .from("gift_backdrops")
        .select("id, name, center_color, edge_color, pattern_color, text_color")
        .order("id"),
      supabase.from("gift_patterns").select("id, key, name, png_path").order("name"),
    ]).then(([b, p]) => {
      setBackdrops((b.data ?? []) as GiftBackdrop[]);
      setPatterns((p.data ?? []) as GiftPattern[]);
    });
  }, []);

  useEffect(() => {
    if (!cid) return;
    supabase
      .from("gift_models")
      .select("id, name, lottie_path, png_path")
      .eq("collection_id", cid)
      .order("name")
      .then(({ data }) => setModels((data ?? []) as GiftModel[]));
  }, [cid]);

  const pickable = models.filter((m) => m.id !== col?.base?.id);
  const model = pickable.find((m) => m.id === modelId) ?? null;
  const backdrop = backdrops.find((b) => String(b.id) === backId) ?? null;
  const pattern = patterns.find((p) => String(p.id) === patId) ?? null;

  async function give(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    const { error } = await supabase.rpc("admin_give_gift", {
      p_username: username.trim(),
      p_collection: cid,
      p_upgraded: upgraded,
      p_model: upgraded && modelId ? modelId : null,
      p_backdrop: upgraded && backId ? Number(backId) : null,
      p_pattern: upgraded && patId ? Number(patId) : null,
    });
    setBusy(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    setOk(`Выдано пользователю @${username.trim()}`);
  }

  const sel = "input";

  return (
    <form onSubmit={give} className="space-y-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Выдать подарок</h2>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
        <input
          className="input pl-9"
          placeholder="Юзернейм получателя"
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ""))}
          required
        />
      </div>

      <select
        className={sel}
        value={cid}
        onChange={(e) => {
          setColId(e.target.value);
          setModelId("");
        }}
      >
        {cols.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setUpgraded(true)}
          className={upgraded ? "btn-primary !py-2 text-sm" : "btn-ghost"}
        >
          Прокачанный
        </button>
        <button
          type="button"
          onClick={() => setUpgraded(false)}
          className={!upgraded ? "btn-primary !py-2 text-sm" : "btn-ghost"}
        >
          Обычный
        </button>
      </div>

      {upgraded && (
        <>
          <select className={sel} value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">Модель: случайная</option>
            {pickable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select className={sel} value={backId} onChange={(e) => setBackId(e.target.value)}>
            <option value="">Фон: случайный</option>
            {backdrops.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className={sel} value={patId} onChange={(e) => setPatId(e.target.value)}>
            <option value="">Узор: случайный</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="mx-auto w-40">
            <GiftArt
              model={model ?? col?.base ?? null}
              backdrop={backdrop}
              pattern={backdrop ? pattern : null}
            />
          </div>
          <p className="text-center text-xs text-muted">
            Предпросмотр. Пустые поля выпадут случайно по шансам.
          </p>
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {ok && <p className="text-sm text-green-600">{ok}</p>}
      <button disabled={busy || !username || !cid} className="btn-primary w-full py-3">
        {busy ? "Выдаём..." : "Выдать"}
      </button>
    </form>
  );
}

export default function AdminGiftsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("gift_collections")
      .select(COLLECTION_SELECT)
      .order("created_at");
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
        здесь выставляете цену, тираж и включаете продажу. Поле «± сток» добавляет к тиражу (можно с
        минусом).
      </p>
      {cols.length === 0 && <p className="py-8 text-center text-muted">Подарков ещё нет.</p>}
      {cols.map((c) => (
        <Row key={c.id} c={c} onSaved={load} />
      ))}
      {cols.length > 0 && <GiveGift cols={cols} />}
    </div>
  );
}