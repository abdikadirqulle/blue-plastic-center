import { z } from "zod";
export type { ResourceParams } from "@blue-plastic/types";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sort: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const writeSchema = z.object({
  status: z.string().trim().min(1).optional(),
  version: z.number().int().positive().optional(),
  data: z.record(z.unknown()),
});
