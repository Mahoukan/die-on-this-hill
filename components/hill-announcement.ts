import { useEffect, useState } from 'react';
import type { HillAnnouncement } from '../shared/types';

export function useActiveHillAnnouncement(announcement: HillAnnouncement | null, serverNow: number): HillAnnouncement | null {
  const [active, setActive] = useState<HillAnnouncement | null>(null);
  const playerId = announcement?.playerId;
  const activatedAt = announcement?.activatedAt;
  const expiresAt = announcement?.expiresAt;

  useEffect(() => {
    if (!announcement) { setActive(null); return; }
    const clockOffset = serverNow - Date.now();
    const remaining = announcement.expiresAt - Date.now() - clockOffset;
    if (remaining <= 0) { setActive(null); return; }
    setActive(announcement);
    const timer = window.setTimeout(() => {
      setActive((current) => current?.activatedAt === announcement.activatedAt && current.playerId === announcement.playerId ? null : current);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [playerId, activatedAt, expiresAt, serverNow]);

  return active;
}
