"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function GiftSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="modal-in relative flex max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}