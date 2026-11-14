"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS, birthError, formatDay, maxBirth, minBirthYear, toIso } from "@/lib/birthday";

type View = "days" | "months" | "years";
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const navBtn =
  "grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-brand-soft disabled:opacity-30 disabled:hover:bg-transparent";

type Props = { value: string; onChange: (iso: string) => void };

export default function BirthDatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [year, setYear] = useState(2000);
  const [month, setMonth] = useState(1);
  const [yearStart, setYearStart] = useState(1992);
  const boxRef = useRef<HTMLDivElement>(null);

  const mb = maxBirth();
  const minY = minBirthYear();
  const maxY = mb.y;

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (value) {
      const [y, m] = value.split("-").map(Number);
      setYear(y);
      setMonth(m);
      setView("days");
    } else {
      // дату ещё не выбирали: сразу показываем годы
      setYear(maxY);
      setMonth(mb.m);
      setYearStart(Math.floor(maxY / 12) * 12);
      setView("years");
    }
    setOpen(true);
  }

  function target(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    return { y, m };
  }

  function navDisabled(delta: number) {
    if (view === "days") {
      const t = target(delta);
      return birthError(toIso(t.y, t.m, 1)) !== null;
    }
    if (view === "months") return year + delta < minY || year + delta > maxY;
    return delta < 0 ? yearStart <= minY : yearStart + 12 > maxY;
  }

  function nav(delta: number) {
    if (navDisabled(delta)) return;
    if (view === "days") {
      const t = target(delta);
      setYear(t.y);
      setMonth(t.m);
    } else if (view === "months") {
      setYear(year + delta);
    } else {
      setYearStart(yearStart + delta * 12);
    }
  }

  function pickYear(y: number) {
    setYear(y);
    if (y === mb.y && month > mb.m) setMonth(mb.m);
    setView("months");
  }

  function pickMonth(m: number) {
    setMonth(m);
    setView("days");
  }

  function pickDay(d: number) {
    onChange(toIso(year, month, d));
    setOpen(false);
  }

  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];

  const cellBase = "rounded-xl py-2 text-sm font-medium transition";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="input flex items-center justify-between text-left"
      >
        <span className={value ? "" : "text-muted"}>
          {value ? formatDay(value) : "Дата рождения"}
        </span>
        <CalendarDays size={20} className="text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-w-sm rounded-2xl border border-line bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Назад"
              disabled={navDisabled(-1)}
              onClick={() => nav(-1)}
              className={navBtn}
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1 font-semibold">
              {view === "days" && (
                <>
                  <button
                    type="button"
                    onClick={() => setView("months")}
                    className="rounded-full px-3 py-1 hover:bg-brand-soft"
                  >
                    {MONTHS[month - 1]}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setYearStart(Math.floor(year / 12) * 12);
                      setView("years");
                    }}
                    className="rounded-full px-3 py-1 hover:bg-brand-soft"
                  >
                    {year}
                  </button>
                </>
              )}
              {view === "months" && (
                <button
                  type="button"
                  onClick={() => {
                    setYearStart(Math.floor(year / 12) * 12);
                    setView("years");
                  }}
                  className="rounded-full px-3 py-1 hover:bg-brand-soft"
                >
                  {year}
                </button>
              )}
              {view === "years" && (
                <span className="px-3 py-1">
                  {yearStart}–{yearStart + 11}
                </span>
              )}
            </div>

            <button
              type="button"
              aria-label="Вперёд"
              disabled={navDisabled(1)}
              onClick={() => nav(1)}
              className={navBtn}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {view === "days" && (
            <>
              <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="py-1">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 place-items-center gap-y-1">
                {cells.map((d, i) => {
                  if (d === null) return <span key={`e${i}`} />;
                  const iso = toIso(year, month, d);
                  const disabled = birthError(iso) !== null;
                  const selected = value === iso;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDay(d)}
                      className={`h-9 w-9 rounded-full text-sm font-medium transition ${
                        selected
                          ? "bg-brand-strong text-white"
                          : disabled
                          ? "cursor-not-allowed text-muted/40"
                          : "hover:bg-brand-soft"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "months" && (
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((name, i) => {
                const disabled = birthError(toIso(year, i + 1, 1)) !== null;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickMonth(i + 1)}
                    className={`${cellBase} ${
                      i + 1 === month
                        ? "bg-brand-soft text-brand-strong"
                        : disabled
                        ? "cursor-not-allowed text-muted/40"
                        : "hover:bg-brand-soft"
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          {view === "years" && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => {
                const disabled = y < minY || y > maxY;
                return (
                  <button
                    key={y}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickYear(y)}
                    className={`${cellBase} ${
                      y === year
                        ? "bg-brand-soft text-brand-strong"
                        : disabled
                        ? "cursor-not-allowed text-muted/40"
                        : "hover:bg-brand-soft"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}