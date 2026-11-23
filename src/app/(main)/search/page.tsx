"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type Result = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  via?: string;
};

type AliasRow = { alias: string; profiles: Omit<Result, "via"> | null };

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState("");

  const term = q.trim().replace(/[%,()*\\"]/g, "");

  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const [byProfile, byAlias] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio")
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
          .limit(20),
        supabase
          .from("profile_aliases")
          .select("alias, profiles!user_id(id, username, display_name, avatar_url, bio)")
          .ilike("alias", `%${term}%`)
          .limit(20),
      ]);

      const list: Result[] = [...(byProfile.data ?? [])];
      for (const row of (byAlias.data ?? []) as unknown as AliasRow[]) {
        if (row.profiles && !list.some((r) => r.id === row.profiles!.id)) {
          list.push({ ...row.profiles, via: row.alias });
        }
      }
      setResults(list.slice(0, 20));
      setSearched(term);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const ready = term.length >= 2 && searched === term;

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">Поиск</h1>

      <div className="relative">
        <SearchIcon
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          className="input pl-12"
          placeholder="Найти людей по имени или логину"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      {term.length < 2 && (
        <p className="py-10 text-center text-muted">Введите минимум 2 символа.</p>
      )}

      {term.length >= 2 && !ready && (
        <p className="py-10 text-center text-muted">Ищем...</p>
      )}

      {ready && results.length === 0 && (
        <p className="py-10 text-center text-muted">Никого не нашли.</p>
      )}

      {ready && results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {results.map((r) => {
            const name = r.display_name || r.username;
            return (
              <Link
                key={r.id}
                href={`/u/${r.username}`}
                className="flex items-center gap-3 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-brand-soft"
              >
                <Avatar url={r.avatar_url} name={name} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="truncate text-sm text-muted">
                    @{r.username}
                    {r.via && <span> · также @{r.via}</span>}
                  </p>
                  {r.bio && <p className="mt-0.5 truncate text-sm">{r.bio}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}