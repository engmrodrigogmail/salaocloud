/**
 * Builds a natural inline reference to a salon, avoiding redundant
 * prefixes like "salão Salão X" or "salão Centro Estético Y".
 *
 * If the establishment name already starts with a self-referential noun
 * (salão, centro estético, barbearia, studio, spa, clínica, atelier...),
 * returns the name as-is. Otherwise prepends "salão ".
 */
export function salonInlineReference(name?: string | null): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "salão";
  const lower = trimmed.toLowerCase();
  const prefixes = [
    "salão", "salao",
    "centro estético", "centro estetico",
    "barbearia",
    "studio", "estúdio", "estudio",
    "spa",
    "clínica", "clinica",
    "atelier", "ateliê",
    "instituto",
    "espaço", "espaco",
  ];
  if (prefixes.some((p) => lower.startsWith(p))) {
    return trimmed;
  }
  return `salão ${trimmed}`;
}
