"use client";

import { useEffect, useState } from "react";
import type { EnterpriseModule, EnterpriseRecord } from "../domain/enterprise-record";
import { enterpriseService } from "../services/enterprise-service";

export function useEnterpriseRecords(module: EnterpriseModule, resource: string, search: string, status: string) {
  const [records, setRecords] = useState<EnterpriseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    enterpriseService.list(module, resource, { search, status }).then((result) => {
      if (!active) return;
      setRecords(result); setError(null); setLoading(false);
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : "Unable to load records"); setLoading(false);
    });
    return () => { active = false; };
  }, [module, resource, search, status]);
  const updateStatus = async (id: string, nextStatus: string) => {
    const updated = await enterpriseService.update(module, resource, id, { status: nextStatus });
    setRecords((current) => current.map((record) => record.id === id ? updated : record));
  };
  const remove = async (id: string) => {
    await enterpriseService.remove(module, resource, id);
    setRecords((current) => current.filter((record) => record.id !== id));
  };
  return { records, loading, error, updateStatus, remove };
}
