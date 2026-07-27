"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  OperationRecord,
  OperationsModule,
  OperationsQuery,
  OperationsResource,
} from "../domain/operation-record";
import { operationsService } from "../services/operations-service";

export function useOperationRecords(
  module: OperationsModule,
  resource: OperationsResource,
  query: OperationsQuery,
) {
  const [records, setRecords] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, status, from, to } = query;
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await operationsService.list(module, resource, { search, status, from, to }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load records");
    } finally {
      setLoading(false);
    }
  }, [module, resource, search, status, from, to]);

  useEffect(() => {
    let active = true;
    operationsService.list(module, resource, { search, status, from, to })
      .then((result) => {
        if (!active) return;
        setRecords(result);
        setError(null);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Unable to load records");
        setLoading(false);
      });
    return () => { active = false; };
  }, [module, resource, search, status, from, to]);

  const remove = async (id: string) => {
    await operationsService.remove(module, resource, id);
    setRecords((current) => current.filter((record) => record.id !== id));
  };

  const updateStatus = async (id: string, status: string) => {
    const updated = await operationsService.update(module, resource, id, { status });
    setRecords((current) => current.map((record) => record.id === id ? updated : record));
  };

  return { records, loading, error, reload, remove, updateStatus };
}
