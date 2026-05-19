// Converte valor em reais para extenso em português (BR).
// Suporta até bilhões. Centavos opcionais.

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function trio(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (d === 1) {
    parts.push(DEZ_A_DEZENOVE[u]);
  } else {
    if (d > 0) parts.push(DEZENAS[d]);
    if (u > 0) parts.push(UNIDADES[u]);
  }
  return parts.join(" e ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const bilhoes = Math.floor(n / 1_000_000_000);
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (bilhoes > 0) parts.push(trio(bilhoes) + (bilhoes === 1 ? " bilhão" : " bilhões"));
  if (milhoes > 0) parts.push(trio(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  if (milhares > 0) parts.push(milhares === 1 ? "mil" : trio(milhares) + " mil");
  if (resto > 0) parts.push(trio(resto));
  return parts.join(" e ");
}

export function valorPorExtensoBRL(valor: number): string {
  const v = Math.max(0, Math.round(valor * 100) / 100);
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  const parts: string[] = [];
  if (reais > 0) parts.push(inteiroPorExtenso(reais) + " " + (reais === 1 ? "real" : "reais"));
  if (centavos > 0) parts.push(inteiroPorExtenso(centavos) + " " + (centavos === 1 ? "centavo" : "centavos"));
  if (parts.length === 0) return "zero real";
  return parts.join(" e ");
}
