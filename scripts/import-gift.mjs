// Запуск: npm run import-gift -- "Plush Pepe"
import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";

const CDN = "https://cdn.changes.tg/gifts";
const BUCKET = "gifts";
const name = process.argv[2];
if (!name) {
  console.error('Укажите подарок: npm run import-gift -- "Plush Pepe"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY в .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const enc = encodeURIComponent;
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
const slug = slugOf(name);

async function getJson(path, asListing = false) {
  const res = await fetch(`${CDN}/${path}`, asListing ? { headers: { Accept: "application/json" } } : undefined);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}
async function getBuf(path) {
  const res = await fetch(`${CDN}/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
async function upload(path, body, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`загрузка ${path}: ${error.message}`);
}
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

const base = `models/${enc(name)}`;
const files = await getJson(`${base}/`, true);
const tgs = files.filter((f) => !f.is_dir && f.name.endsWith(".tgs"));
if (tgs.length === 0) throw new Error("Не найдено ни одного .tgs. Проверьте название подарка.");
console.log(`Моделей: ${tgs.length}`);

let pngs = [];
try {
  pngs = (await getJson(`${base}/png/`, true)).filter((f) => !f.is_dir && /\.png$/i.test(f.name));
} catch {
  console.warn("PNG не найдены, в списках будет первый кадр анимации");
}
const pngByName = new Map(pngs.map((f) => [f.name.replace(/\.png$/i, "").toLowerCase(), f.name]));

// редкость из models.json (если формат подходит), иначе все модели равны
const rarity = new Map();
try {
  const raw = await getJson(`${base}/models.json`);
  for (const m of Array.isArray(raw) ? raw : Object.values(raw)) {
    const r = m?.rarityPermille ?? m?.rarity;
    if (m?.name && typeof r === "number" && r > 0) rarity.set(String(m.name).toLowerCase(), r);
  }
} catch {}
console.log(`Редкость найдена для ${rarity.size} моделей (остальным вес 20)`);

// коллекция: при повторном запуске цены и сток не трогаем
let { data: col } = await sb.from("gift_collections").select("id").eq("slug", slug).maybeSingle();
if (!col) {
  const { data, error } = await sb.from("gift_collections").insert({ slug, name }).select("id").single();
  if (error) throw error;
  col = data;
}

const rows = [];
await inBatches(tgs, 5, async (f) => {
  const model = f.name.replace(/\.tgs$/i, "");
  const ms = slugOf(model);
  const json = gunzipSync(await getBuf(`${base}/${enc(f.name)}`)).toString("utf8");
  JSON.parse(json);
  const lottiePath = `${slug}/models/${ms}.json`;
  await upload(lottiePath, json, "application/json");

  let pngPath = null;
  const pngName = pngByName.get(model.toLowerCase());
  if (pngName) {
    pngPath = `${slug}/png/${ms}.png`;
    await upload(pngPath, await getBuf(`${base}/png/${enc(pngName)}`), "image/png");
  }
  rows.push({
    collection_id: col.id,
    name: model,
    weight: rarity.get(model.toLowerCase()) ?? 20,
    lottie_path: lottiePath,
    png_path: pngPath,
  });
  process.stdout.write(".");
});
console.log("");

const { error: mErr } = await sb.from("gift_models").upsert(rows, { onConflict: "collection_id,name" });
if (mErr) throw mErr;

// обычная версия подарка показывается моделью Original (или первой)
const { data: baseRow } = await sb
  .from("gift_models").select("id").eq("collection_id", col.id).ilike("name", "original").maybeSingle();
const baseId = baseRow?.id ?? (await sb.from("gift_models").select("id").eq("collection_id", col.id).limit(1)).data?.[0]?.id;
if (baseId) await sb.from("gift_collections").update({ base_model_id: baseId }).eq("id", col.id);

// фоны: общие для всех подарков, Black самый редкий; существующие веса не перезаписываем
const bd = await getJson("backdrops.json");
const bdRows = bd.map((b) => ({
  id: b.backdropId,
  name: b.name,
  center_color: b.hex.centerColor,
  edge_color: b.hex.edgeColor,
  pattern_color: b.hex.patternColor,
  text_color: b.hex.textColor,
  weight: b.backdropId === 0 ? 2 : 20,
}));
const { error: bErr } = await sb.from("gift_backdrops").upsert(bdRows, { onConflict: "id", ignoreDuplicates: true });
if (bErr) throw bErr;

console.log(`Готово: ${name}, моделей ${rows.length}, фонов ${bdRows.length}. Цену и сток задайте в /admin/gifts.`);