import { supabase } from "@/lib/supabase/client";

export type Odds = {
  models: Map<string, number>;
  backdrops: Map<number, number>;
  patterns: Map<number, number>;
};

const cache = new Map<string, Promise<Odds>>();

function share<K>(rows: { id: K; weight: number }[] | null, skip?: K | null) {
  const list = (rows ?? []).filter((r) => r.id !== skip);
  const sum = list.reduce((s, r) => s + r.weight, 0) || 1;
  return new Map<K, number>(list.map((r) => [r.id, (r.weight / sum) * 100]));
}

// шансы в процентах; Original в розыгрыше не участвует
export function getOdds(collectionId: string, baseModelId: string | null): Promise<Odds> {
  const key = `${collectionId}:${baseModelId ?? ""}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const [m, b, pt] = await Promise.all([
        supabase.from("gift_models").select("id, weight").eq("collection_id", collectionId),
        supabase.from("gift_backdrops").select("id, weight"),
        supabase.from("gift_patterns").select("id, weight"),
      ]);
      return {
        models: share<string>(m.data, baseModelId),
        backdrops: share<number>(b.data),
        patterns: share<number>(pt.data),
      };
    })();
    cache.set(key, p);
  }
  return p;
}

export function fmtPct(x?: number) {
  if (x === undefined) return "";
  if (x < 0.1) return "<0,1%";
  const v = x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  return `${String(v).replace(".", ",")}%`;
}