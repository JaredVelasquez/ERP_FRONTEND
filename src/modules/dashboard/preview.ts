export const dashboardPreview = {
  stats: [
    { label: 'Ventas de hoy', value: 'L 4,860.00' },
    { label: 'Existencia', value: '186 und.' },
    { label: 'Comprobantes', value: '1 borrador' },
    { label: 'Alertas', value: '2' },
  ],
  movements: [
    ['2026-10-03', 'Salida', 'Aceite 750 ml', '2', 'Venta mostrador'],
    ['2026-10-02', 'Entrada', 'Arroz 1 lb', '24', 'Compra bodega'],
    ['2026-10-01', 'Salida', 'Leche 1 L', '6', 'Venta mostrador'],
    ['2026-09-30', 'Entrada', 'Frijol 5 lb', '10', 'Compra bodega'],
  ],
} as const
