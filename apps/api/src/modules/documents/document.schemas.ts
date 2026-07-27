import { z } from "zod"

export const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
})

export const pdfJobSchema = z.object({
  template: z.enum(["invoice", "estimate", "sales-order", "receipt", "credit-note", "purchase-order", "bill", "check"]),
})
