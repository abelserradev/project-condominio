import { Workbook } from 'exceljs';
import type {
  FilaCobranzaDetalle,
  ReporteCobranza,
} from '../cobranza-report.service';

// Nombres de meses para la columna "Meses pendientes" — el admin lee el
// Excel, no quiere números crudos.
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function etiquetaCategoria(fila: FilaCobranzaDetalle): string {
  return fila.categoria === 'moroso' ? 'Moroso' : 'Al día';
}

/**
 * Construye el workbook del reporte: hoja Resumen (totales) + hoja Detalle
 * (una fila por apartamento). Columnas fijadas en specs/api/reporte-cobranza-api-v1.md.
 */
export async function buildCobranzaWorkbook(
  reporte: ReporteCobranza,
): Promise<Buffer> {
  const wb = new Workbook();
  wb.creator = 'URBIX Condominio';
  wb.created = new Date(reporte.generadoEn);

  const hojaResumen = wb.addWorksheet('Resumen');
  hojaResumen.columns = [{ width: 32 }, { width: 18 }];
  hojaResumen.addRows([
    ['Reporte de cobranza', ''],
    ['Generado', reporte.generadoEn],
    [],
    ['Total apartamentos', reporte.resumen.totalApartamentos],
    ['Al día', reporte.resumen.alDia],
    ['Morosos', reporte.resumen.morosos],
    ['Con pago en revisión', reporte.resumen.enRevision],
  ]);
  hojaResumen.getCell('A1').font = { bold: true, size: 14 };

  const detalle = wb.addWorksheet('Detalle');
  detalle.columns = [
    { header: 'Piso', key: 'piso', width: 8 },
    { header: 'Apartamento', key: 'apartamento', width: 12 },
    { header: 'Categoría', key: 'categoria', width: 12 },
    { header: 'Saldo bruto USD', key: 'saldoBruto', width: 16 },
    { header: 'Abono USD', key: 'abono', width: 12 },
    { header: 'Saldo neto USD', key: 'saldoNeto', width: 15 },
    { header: 'Meses pendientes', key: 'meses', width: 28 },
    { header: 'Tipos de deuda', key: 'tipos', width: 24 },
    { header: 'Pago en revisión', key: 'revision', width: 16 },
    { header: 'Cant. pagos en revisión', key: 'cantRevision', width: 22 },
    { header: 'Monto en revisión USD', key: 'montoRevision', width: 20 },
    { header: 'Propietario', key: 'propietario', width: 26 },
    { header: 'Email propietario', key: 'email', width: 30 },
  ];
  detalle.getRow(1).font = { bold: true };

  for (const fila of reporte.filas) {
    detalle.addRow({
      piso: fila.piso,
      apartamento: fila.apartamento,
      categoria: etiquetaCategoria(fila),
      saldoBruto: fila.saldoBrutoUsd,
      abono: fila.abonoUsd,
      saldoNeto: fila.saldoNetoUsd,
      meses: fila.mesesPendientes.map((m) => MESES[m - 1] ?? m).join(', '),
      tipos: fila.tiposDeuda.join(', '),
      revision: fila.tienePagoEnRevision ? 'SI' : 'NO',
      cantRevision: fila.cantidadPagosEnRevision,
      montoRevision: fila.montoEnRevisionUsd,
      propietario: fila.propietario ?? '',
      email: fila.emailPropietario ?? '',
    });
  }

  for (const key of ['saldoBruto', 'abono', 'saldoNeto', 'montoRevision']) {
    detalle.getColumn(key).numFmt = '#,##0.00';
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
