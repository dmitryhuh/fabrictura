export const MIN_AGE = 13;

export const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isValidDate(y: number, m: number, d: number) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function calcAge(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  const month = now.getMonth() + 1;
  if (month < m || (month === m && now.getDate() < d)) age--;
  return age;
}

// самая поздняя допустимая дата рождения (сегодня минус MIN_AGE лет)
export function maxBirth() {
  const t = new Date();
  return { y: t.getFullYear() - MIN_AGE, m: t.getMonth() + 1, d: t.getDate() };
}

export function minBirthYear() {
  return new Date().getFullYear() - 110;
}

// null, если дата допустима, иначе текст ошибки
export function birthError(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || !isValidDate(y, m, d)) return "Такой даты не существует";
  if (new Date(y, m - 1, d) > new Date()) return "Дата не может быть в будущем";
  if (y < minBirthYear()) return "Проверьте год рождения";
  if (calcAge(iso) < MIN_AGE) return `Регистрация доступна с ${MIN_AGE} лет`;
  return null;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// "12 мая 2008"
export function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
}

// "12 мая 2008 (18 лет)"
export function formatBirth(iso: string) {
  const age = calcAge(iso);
  return `${formatDay(iso)} (${age} ${plural(age, "год", "года", "лет")})`;
}