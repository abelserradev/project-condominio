/** Reparte monto del pago, excedente a abono de apto y uso de abono existente */
export function calcularAplicacionPagoConAbono(
  montoPago: number,
  totalDeuda: number,
  abonoDisponible: number,
): {
  amountFromPayment: number;
  excess: number;
  amountFromAbono: number;
  totalToApply: number;
} {
  const amountFromPayment = Math.min(montoPago, totalDeuda);
  const excess = Math.max(0, montoPago - totalDeuda);
  const amountFromAbono = Math.min(
    abonoDisponible,
    totalDeuda - amountFromPayment,
  );
  const totalToApply = amountFromPayment + amountFromAbono;
  return { amountFromPayment, excess, amountFromAbono, totalToApply };
}
