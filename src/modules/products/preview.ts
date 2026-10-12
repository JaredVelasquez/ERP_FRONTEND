export type ProductRow = {
  name: string
  presentation: string
  factor: string
  barcode: string
  stock: string
}

export const productPreview: ProductRow[] = [
  { name: 'Arroz 1 lb', presentation: 'Bolsa 1 lb', factor: '1', barcode: '7401000000011', stock: '48' },
  { name: 'Aceite 750 ml', presentation: 'Botella 750 ml', factor: '1', barcode: '7401000000028', stock: '16' },
  { name: 'Frijol 5 lb', presentation: 'Saco 5 lb', factor: '5', barcode: '7401000000035', stock: '10' },
  { name: 'Azúcar 2 kg', presentation: 'Bolsa 2 kg', factor: '1', barcode: '7401000000042', stock: '22' },
  { name: 'Leche 1 L', presentation: 'Caja 1 L', factor: '1', barcode: '7401000000059', stock: '30' },
]
