"use client";

/**
 * NotificationBell (#40) — the header bell + dropdown notification center.
 *
 * - Shows a 🔔 button with an unread-count badge.
 * - Clicking opens a dropdown listing recent notifications (newest first).
 * - Unread items are highlighted; clicking one marks it read and (if it has a
 *   link) navigates there.
 * - "Mark all read" clears every unread badge at once.
 * - Polls for new notifications every 60s so the badge stays fresh without a
 *   full page reload.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/api";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await getUnreadNotificationCount());
    } catch {
      // ignore — never break the header over notifications
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getNotifications(30);
      setItems(list);
      setUnread(list.filter((n) => !n.readAt).length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial count + poll every 60s.
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 60_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Load the full list whenever the dropdown opens.
  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  // Close when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleItemClick(n: Notification) {
    if (!n.readAt) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x
          )
        );
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        // ignore
      }
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() }))
      );
      setUnread(0);
    } catch {
      // ignore
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-lg border border-slate-200 px-4 py-2"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold text-slate-800">Notifications</span>
            {items.some((n) => !n.readAt) && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                You're all caught up. No notifications yet.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
                    n.readAt ? "" : "bg-blue-50/60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                    )}
                    <div className={n.readAt ? "pl-4" : ""}>
                      <p className="text-sm font-semibold text-slate-800">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
