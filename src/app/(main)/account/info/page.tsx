"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import BirthDatePicker from "@/components/BirthDatePicker";
import EmojiButton, { insertEmoji } from "@/components/EmojiButton";
import { EditTabs, PageHead, StatusLine } from "@/components/AccountUi";
import { birthError } from "@/lib/birthday";
import {
  MAX_ALIASES,
  USERNAME_HINT,
  USERNAME_RE,
  useUsernameStatus,
} from "@/lib/username";

const LABEL = "block px-1 text-xs font-semibold uppercase tracking-wide text-muted";

export default function InfoPage() {
  const { me, refresh } = useMe();
  const [loaded, setLoaded] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasList, setAliasList] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [userInput, setUserInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [birthInput, setBirthInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const mainName = userInput.trim().toLowerCase();
  const mainStatus = useUsernameStatus(mainName, [savedName]);
  const aliasStatus = useUsernameStatus(aliasDraft, [mainName, ...aliasList]);

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, display_name, bio, birth_date")
        .eq("id", me.id)
        .single(),
      supabase.from("profile_aliases").select("alias").eq("user_id", me.id).order("created_at"),
    ]);
    if (p.error || !p.data) {
      setError(p.error?.message ?? "Не удалось загрузить данные");
      return;
    }
    const list = (a.data ?? []).map((r) => r.alias);
    setSavedName(p.data.username);
    setUserInput(p.data.username);
    setNameInput(p.data.display_name ?? "");
    setBioInput(p.data.bio ?? "");
    setBirthInput(p.data.birth_date ?? "");
    setAliases(list);
    setAliasList(list);
    setLoaded(true);
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  function addAlias() {
    const a = aliasDraft.trim().toLowerCase();
    if (!a) return;
    if (!USERNAME_RE.test(a)) {
      setError(`Юзернейм: ${USERNAME_HINT}`);
      return;
    }
    if (a === mainName) {
      setError("Это ваш основной юзернейм");
      return;
    }
    if (aliasList.includes(a)) {
      setError("Этот юзернейм уже в списке");
      return;
    }
    if (aliasList.length >= MAX_ALIASES) {
      setError(`Не больше ${MAX_ALIASES} дополнительных юзернеймов`);
      return;
    }
    setError("");
    setAliasList((l) => [...l, a]);
    setAliasDraft("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");

    // старый логин не проверяем, правило действует только при смене
    if (mainName !== savedName && !USERNAME_RE.test(mainName)) {
      setError(`Юзернейм: ${USERNAME_HINT}`);
      return;
    }
    if (birthInput) {
      const problem = birthError(birthInput);
      if (problem) {
        setError(problem);
        return;
      }
    }
    if (aliasList.includes(mainName)) {
      setError("Этот юзернейм уже в списке дополнительных, уберите его оттуда");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: mainName,
        display_name: nameInput.trim() || null,
        bio: bioInput.trim() || null,
        birth_date: birthInput || null,
      })
      .eq("id", me.id);

    if (error) {
      setSaving(false);
      if (error.code === "23505") setError("Этот юзернейм уже занят");
      else if (error.message.includes("username_invalid")) setError(`Юзернейм: ${USERNAME_HINT}`);
      else if (error.message.includes("profiles_birth_check"))
        setError("Недопустимая дата рождения");
      else setError(error.message);
      return;
    }

    // дополнительные логины: удаляем убранные, добавляем новые
    const toDelete = aliases.filter((a) => !aliasList.includes(a));
    const toAdd = aliasList.filter((a) => !aliases.includes(a));
    let aliasError = "";
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("profile_aliases")
        .delete()
        .eq("user_id", me.id)
        .in("alias", toDelete);
      if (delErr) aliasError = delErr.message;
    }
    if (!aliasError && toAdd.length > 0) {
      const { error: addErr } = await supabase
        .from("profile_aliases")
        .insert(toAdd.map((alias) => ({ alias, user_id: me.id })));
      if (addErr) {
        if (addErr.code === "23505") aliasError = "Один из дополнительных юзернеймов уже занят";
        else if (addErr.message.includes("alias_limit"))
          aliasError = `Не больше ${MAX_ALIASES} дополнительных юзернеймов`;
        else if (addErr.message.includes("alias_invalid"))
          aliasError = `Юзернейм: ${USERNAME_HINT}`;
        else aliasError = addErr.message;
      }
    }
    setSavedName(mainName);
    setSaving(false);

    if (aliasError) {
      // остальное уже сохранено, показываем актуальный список
      const { data: fresh } = await supabase
        .from("profile_aliases")
        .select("alias")
        .eq("user_id", me.id)
        .order("created_at");
      const list = (fresh ?? []).map((r) => r.alias);
      setAliases(list);
      setAliasList(list);
      setError(aliasError);
      await refresh();
      return;
    }

    setAliases(aliasList);
    setOk("Сохранено");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <PageHead title="Аккаунт" />
      <EditTabs />

      {!loaded ? (
        <p className="py-10 text-center text-muted">{error || "Загрузка..."}</p>
      ) : (
        <form onSubmit={save} className="space-y-5 rounded-xl border border-line bg-white p-5">
          <div className="space-y-1.5">
            <label htmlFor="edit-name" className={LABEL}>
              Имя
            </label>
            <input
              id="edit-name"
              className="input"
              maxLength={30}
              placeholder="Как вас зовут"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="edit-username" className={LABEL}>
              Юзернейм
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input
                id="edit-username"
                className="input pl-9"
                maxLength={20}
                placeholder="Юзернейм"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value.toLowerCase().replace(/\s/g, ""))}
              />
            </div>
            {aliasList.includes(mainName) ? (
              <p className="mt-1.5 min-h-5 px-1 text-xs text-red-500">
                Он есть в дополнительных, уберите его оттуда
              </p>
            ) : (
              <StatusLine
                status={mainStatus}
                same={<span className="text-muted">{USERNAME_HINT}</span>}
              />
            )}
          </div>

          <div>
            <p className={LABEL}>
              Дополнительные юзернеймы ({aliasList.length}/{MAX_ALIASES})
            </p>
            {aliasList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {aliasList.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1.5 text-sm"
                  >
                    @{a}
                    <button
                      type="button"
                      onClick={() => setAliasList((l) => l.filter((x) => x !== a))}
                      aria-label={`Удалить ${a}`}
                      className="grid h-5 w-5 place-items-center rounded-full text-muted transition hover:bg-white hover:text-ink"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {aliasList.length < MAX_ALIASES && (
              <>
                <div className="mt-2 flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                    <input
                      className="input pl-9"
                      maxLength={20}
                      placeholder="Новый юзернейм"
                      aria-label="Новый дополнительный юзернейм"
                      value={aliasDraft}
                      onChange={(e) =>
                        setAliasDraft(e.target.value.toLowerCase().replace(/\s/g, ""))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAlias();
                        }
                      }}
                    />
                  </div>
                  <button type="button" onClick={addAlias} className="btn-ghost shrink-0">
                    Добавить
                  </button>
                </div>
                <StatusLine
                  status={aliasStatus}
                  same={<span className="text-red-500">Этот юзернейм уже у вас</span>}
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-end justify-between">
              <label htmlFor="edit-bio" className={LABEL}>
                О себе
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted">{bioInput.length}/160</span>
                <EmojiButton
                  placement="bottom"
                  align="right"
                  buttonClassName="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
                  onPick={(emoji) => insertEmoji(bioRef.current, bioInput, emoji, 160, setBioInput)}
                />
              </div>
            </div>
            <textarea
              id="edit-bio"
              ref={bioRef}
              className="input resize-none"
              rows={3}
              maxLength={160}
              placeholder="Расскажите о себе"
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className={LABEL}>Дата рождения</p>
            <BirthDatePicker value={birthInput} onChange={setBirthInput} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {ok && <p className="text-sm text-green-600">{ok}</p>}

          <button disabled={saving} className="btn-primary w-full py-3 sm:w-auto sm:px-8">
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>
      )}
    </div>
  );
}