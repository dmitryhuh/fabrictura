// Запуск: npm run import-patterns -- "Plush Pepe"
// Можно указать несколько папок из patterns/ на CDN. Без аргументов покажет, что там лежит.
import { createClient } from "@supabase/supabase-js";

const CDN = "https://cdn.changes.tg/gifts";
const BUCKET = "gifts";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY в .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const enc = encodeURIComponent;
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

async function list(path) {
  const res = await fetch(`${CDN}/${path}/`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({ name: String(r.name).replace(/\/$/, ""), is_dir: !!r.is_dir }));
}

// все PNG внутри папки (заходит во вложенные папки, например png/)
async function collect(path, depth = 2) {
  const out = [];
  let rows;
  try {
    rows = await list(path);
  } catch {
    return out;
  }
  for (const r of rows) {
    if (r.is_dir) {
      if (depth > 0) out.push(...(await collect(`${path}/${enc(r.name)}`, depth - 1)));
    } else if (/\.png$/i.test(r.name)) {
      out.push({ path: `${path}/${enc(r.name)}`, base: r.name.replace(/\.png$/i, "") });
    }
  }
  return out;
}

function walk(node, out) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, out));
  else if (node && typeof node === "object") {
    const r = node.rarityPermille ?? node.rarity;
    if (typeof node.name === "string" && typeof r === "number" && r > 0) {
      out.set(node.name.toLowerCase(), r);
    }
    Object.values(node).forEach((v) => walk(v, out));
  }
}

let targets = process.argv.slice(2);
if (targets.length === 0) {
  const own = await collect("patterns", 0);
  if (own.length > 0) {
    targets = [""];
  } else {
    const root = await list("patterns");
    console.log("Папки в patterns/ на CDN:");
    for (const r of root.filter((x) => x.is_dir)) console.log(" -", r.name);
    console.log('\nЗапустите: npm run import-patterns -- "Plush Pepe"');
    process.exit(0);
  }
}

const found = new Map();
for (const t of targets) {
  const files = await collect(t ? `patterns/${enc(t)}` : "patterns");
  console.log(`${t || "patterns"}: найдено PNG: ${files.length}`);
  for (const f of files) if (!found.has(slugOf(f.base))) found.set(slugOf(f.base), f);
}
if (found.size === 0) throw new Error("PNG не найдены. Запустите без аргументов, чтобы увидеть папки.");

// редкость из patterns.json, если формат подходит
const rarity = new Map();
try {
  const res = await fetch(`${CDN}/patterns.json`);
  if (res.ok) walk(await res.json(), rarity);
} catch {}
console.log(`Редкость найдена для ${rarity.size} узоров (остальным вес 20)`);

const entries = [...found.entries()];
for (let i = 0; i < entries.length; i += 8) {
  await Promise.all(
    entries.slice(i, i + 8).map(async ([slug, f]) => {
      const res = await fetch(`${CDN}/${f.path}`);
      if (!res.ok) throw new Error(`${f.path}: ${res.status}`);
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(`patterns/${slug}.png`, Buffer.from(await res.arrayBuffer()), {
          contentType: "image/png",
          upsert: true,
        });
      if (error) throw new Error(`загрузка ${slug}: ${error.message}`);
      process.stdout.write(".");
    })
  );
}
console.log("");

const { data: existing, error: eErr } = await sb.from("gift_patterns").select("id, key");
if (eErr) throw eErr;
const byKey = new Map((existing ?? []).map((r) => [r.key, r.id]));
let nextId = Math.max(0, ...(existing ?? []).map((r) => r.id)) + 1;

const fresh = [];
const old = [];
for (const [slug, f] of entries) {
  const png_path = `patterns/${slug}.png`;
  if (byKey.has(slug)) {
    old.push({ id: byKey.get(slug), key: slug, name: f.base, png_path });
  } else {
    fresh.push({
      id: nextId++,
      key: slug,
      name: f.base,
      png_path,
      weight: rarity.get(f.base.toLowerCase()) ?? 20,
    });
  }
}
if (fresh.length) {
  const { error } = await sb.from("gift_patterns").insert(fresh);
  if (error) throw error;
}
if (old.length) {
  const { error } = await sb.from("gift_patterns").upsert(old, { onConflict: "id" });
  if (error) throw error;
}
console.log(`Готово: новых ${fresh.length}, обновлено ${old.length}.`);