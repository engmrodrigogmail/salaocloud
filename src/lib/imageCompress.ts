// Comprime imagens no client antes do upload para a API Claude (limite 5MB por imagem).
// Redimensiona mantendo proporção (lado maior <= maxDim) e exporta JPEG com qualidade ajustável.
// Claude limita 5MB no payload base64. Como base64 infla ~33%, mantemos folga ampla
// para metadados/payload e variações de conversão do navegador.
export const AI_IMAGE_MAX_BYTES = 2_500_000;

export async function compressImageForAI(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? 1200;
  let quality = opts.quality ?? 0.72;

  // Sempre re-encoda via canvas (limpa EXIF e garante <= AI_IMAGE_MAX_BYTES).
  // Só pula se já é JPEG/PNG/WebP pequeno E NÃO veio do celular (heurística: < 800KB).
  if (file.size <= 800_000 && /jpe?g|png|webp/i.test(file.type) && !/heic|heif/i.test(file.type)) {
    return file;
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  // Tenta qualidades decrescentes até ficar abaixo do limite
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > AI_IMAGE_MAX_BYTES && quality > 0.32) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  // Se ainda está acima do limite, reduz dimensões e tenta de novo
  let currentMaxDim = maxDim;
  while (blob && blob.size > AI_IMAGE_MAX_BYTES && currentMaxDim > 640) {
    currentMaxDim = Math.round(currentMaxDim * 0.85);
    const w = canvas.width >= canvas.height
      ? currentMaxDim
      : Math.round((canvas.width * currentMaxDim) / canvas.height);
    const h = canvas.height >= canvas.width
      ? currentMaxDim
      : Math.round((canvas.height * currentMaxDim) / canvas.width);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    blob = await canvasToBlob(canvas, 0.68);
  }
  if (!blob) return file;
  if (blob.size > AI_IMAGE_MAX_BYTES) {
    throw new Error("A foto ficou grande demais para análise. Tente enviar uma imagem menor ou tirar a foto novamente com menos zoom.");
  }

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}
