"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const READ_KEY = "lebtech.reseller.notifs.read";

/** Header bell — unread count = notifications not in the localStorage read-set. */
export function ResellerNotificationsBell({ ids }: { ids: string[] }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let read: Set<string>;
    try { read = new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")); } catch { read = new Set(); }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnread(ids.filter((id) => !read.has(id)).length);
  }, [ids, pathname]);

  return (
    <Link href="/reseller/notifications" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative grid size-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]">
      <Bell className="size-5" />
      {unread > 0 ? <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
    </Link>
  );
}
