export const total_pisos = 30;
export const total_apartamentos = 8;

export function buildApartmentsSeed(): {
  piso: number;
  numero: number;
  idUnico: string;
}[] {
  const docs: { piso: number; numero: number; idUnico: string }[] = [];
  for (let p = 1; p <= total_pisos; p++) {
    for (let a = 1; a <= total_apartamentos; a++) {
      docs.push({ piso: p, numero: a, idUnico: `P${p}-A${a}` });
    }
  }
  return docs;
}