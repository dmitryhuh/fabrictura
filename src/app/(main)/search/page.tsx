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
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState("");

  const term = q.trim().replace(/[%,()*\\"]/g, "");

  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .limit(20);
      setResults(data ?? []);
      setSearched(term);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <SearchIcon
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          className="input !rounded-full pl-12"
          placeholder="Найти людей по имени или логину"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      {term.length < 2 && (
        <p className="py-10 text-center text-muted">Введите минимум 2 символа.</p>
      )}

      {term.length >= 2 && searched !== term && (
        <p className="py-10 text-center text-muted">Ищем...</p>
      )}

      {term.length >= 2 && searched === term && results.length === 0 && (
        <p className="py-10 text-center text-muted">Никого не нашли.</p>
      )}

      {term.length >= 2 &&
        searched === term &&
        results.map((r) => {
          const name = r.display_name || r.username;
          return (
            <Link
              key={r.id}
              href={`/u/${r.username}`}
              className="flex items-center gap-4 rounded-3xl border border-line bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <Avatar url={r.avatar_url} name={name} size={52} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{name}</p>
                <p className="truncate text-sm text-muted">@{r.username}</p>
                {r.bio && <p className="mt-1 truncate text-sm">{r.bio}</p>}
              </div>
            </Link>
          );
        })}
    </div>
  );
}