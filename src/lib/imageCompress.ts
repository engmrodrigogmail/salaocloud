// Comprime imagens no client antes do upload para a API Claude (limite 5MB por imagem).
// Redimensiona mantendo proporção (lado maior <= maxDim) e exporta JPEG com qualidade ajustável.
const MAX_BYTES = 4_500_000; // margem de segurança abaixo de 5MB

export async function compressImageForAI(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? 1600;
  let quality = opts.quality ?? 0.82;

  // Se já é pequeno o suficiente e não é HEIC, retorna direto
  if (file.size <= MAX_BYTES && !/heic|heif/i.test(file.type)) {
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
  while (blob && blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob) return file;

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
