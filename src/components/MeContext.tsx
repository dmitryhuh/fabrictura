"use client";

import { createContext, useContext } from "react";

export type Me = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export const MeContext = createContext<{
  me: Me;
  refresh: () => Promise<void>;
  unread: number;
  refreshUnread: () => Promise<void>;
  unreadMessages: number;
  refreshUnreadMessages: () => Promise<void>;
  isAdmin: boolean;
} | null>(null);

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe нужно вызывать внутри оболочки сайта");
  return ctx;
}
