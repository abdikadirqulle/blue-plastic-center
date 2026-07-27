import { z } from "zod"
import { listQuerySchema } from "../resources/resource.schemas.js"

export const trashQuerySchema = listQuerySchema.extend({
  module: z.string().trim().min(1).optional(),
  resource: z.string().trim().min(1).optional(),
})

export const trashParamsSchema = z.object({
  id: z.string().uuid(),
})
