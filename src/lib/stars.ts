export type StarTx = {
  id: string;
  amount: number;
  kind: "grant" | "revoke" | "transfer_in" | "transfer_out";
  note: string | null;
  created_at: string;
  counterparty: { username: string; display_name: string | null } | null;
};

export const MAX_STARS = 1_000_000_000;

export const TX_SELECT =
  "id, amount, kind, note, created_at, counterparty:profiles!counterparty_id(username, display_name)";

export const fmtStars = (n: number) => n.toLocaleString("ru-RU");

export function txTitle(t: StarTx) {
  const who = t.counterparty ? `@${t.counterparty.username}` : "удалённого пользователя";
  if (t.kind === "grant") return "Начисление от администрации";
  if (t.kind === "revoke") return "Списание администрацией";
  return t.kind === "transfer_in" ? `Перевод от ${who}` : `Перевод для ${who}`;
}

export function starsError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("insufficient_stars")) return "Недостаточно звёзд";
  if (m.includes("user_not_found")) return "Пользователь не найден";
  if (m.includes("not_admin")) return "Нет доступа";
  if (m.includes("not_auth")) return "Войдите в аккаунт";
  if (m.includes("bad_amount")) return "Неверная сумма";
  if (m.includes("self_transfer")) return "Нельзя переводить самому себе";
  return msg;
}