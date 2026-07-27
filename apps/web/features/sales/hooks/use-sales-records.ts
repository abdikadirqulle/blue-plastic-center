"use client";

import { useCallback, useEffect, useState } from "react";
import type { SalesQuery, SalesRecord, SalesResource } from "../domain/sales-record";
import { salesService } from "../services/sales-service";

export function useSalesRecords(resource: SalesResource, query: SalesQuery) {
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, status, from, to } = query;
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await salesService.list(resource, { search, status, from, to }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load sales records");
    } finally {
      setLoading(false);
    }
  }, [resource, search, status, from, to]);

  useEffect(() => {
    let active = true;
    salesService.list(resource, { search, status, from, to })
      .then((result) => {
        if (!active) return;
        setRecords(result);
        setError(null);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to load sales records");
        setLoading(false);
      });
    return () => { active = false; };
  }, [resource, search, status, from, to]);

  const remove = async (id: string) => {
    await salesService.remove(resource, id);
    setRecords((current) => current.filter((record) => record.id !== id));
  };

  return { records, loading, error, reload, remove };
}
