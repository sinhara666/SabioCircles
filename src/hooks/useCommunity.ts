"use client";

import { useCallback, useEffect, useState } from "react";

export type CommunityDetail = {
  community: {
    id: string;
    slug: string;
    name: string;
    description: string;
    owner_id: string;
    is_free: number;
    price_ngn_kobo: number;
    price_usd_cents: number;
  };
  memberCount: number;
  membership: { role: string; status: string; points: number; level: number } | null;
};

export function useCommunity(slug: string) {
  const [data, setData] = useState<CommunityDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/communities/${slug}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [refresh]);

  return { data, loading, notFound, refresh };
}
