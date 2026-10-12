import { z } from 'zod'

export const moduleGrantSchema = z.object({
  module: z.string(),
  access: z.enum(['view', 'edit']),
})

export const loginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  companyId: z.string().optional(),
})

export const loginResponseSchema = z.object({
  token: z.string(),
  role: z.enum(['platform-admin', 'owner', 'operator']),
  grants: z.array(z.object({
  module: z.string(),
  access: z.enum(['view', 'edit']),
})),
})

export const barcodeSheetRequestSchema = z.object({
  companyId: z.string(),
  productIds: z.array(z.string()),
})

export const barcodeSheetResponseSchema = z.object({
  pdfBase64: z.string(),
})

export const productSearchResponseSchema = z.object({
  products: z.array(z.object({
  id: z.string(),
  name: z.string(),
  internalBarcode: z.string(),
})),
})

export const stockCardResponseSchema = z.object({
  card: z.object({
  productId: z.string(),
  name: z.string(),
  internalBarcode: z.string(),
  baseQuantity: z.number(),
  unitCost: z.number().optional(),
}),
})

export const inventoryIssueRequestSchema = z.object({
  companyId: z.string(),
  idempotencyKey: z.string(),
  receivedAt: z.string(),
  lines: z.array(z.object({
  productId: z.string(),
  unit: z.string(),
  quantity: z.number(),
})),
})

export const inventoryIssueResponseSchema = z.object({
  document: z.object({
  id: z.string(),
  type: z.string(),
}),
})
