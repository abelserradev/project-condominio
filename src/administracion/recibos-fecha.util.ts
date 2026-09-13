/** Mediodía UTC evita desfases al mostrar fechas YYYY-MM-DD en distintas zonas */
export function parsearFechaReciboUtc(fechaString: string): Date {
  const partes = fechaString.split('-');
  if (partes.length !== 3) {
    const parsed = new Date(fechaString);
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError(`Fecha inválida: ${fechaString}`);
    }
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        12,
        0,
        0,
      ),
    );
  }
  const año = Number.parseInt(partes[0], 10);
  const mes = Number.parseInt(partes[1], 10) - 1;
  const día = Number.parseInt(partes[2], 10);
  const fecha = new Date(Date.UTC(año, mes, día, 12, 0, 0));
  if (Number.isNaN(fecha.getTime())) {
    throw new TypeError(`Fecha inválida: ${fechaString}`);
  }
  return fecha;
}
