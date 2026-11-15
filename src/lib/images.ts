export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function checkImage(file: File, maxMb: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Нужна картинка JPG, PNG или WebP";
  if (file.size > maxMb * 1024 * 1024) return `Файл больше ${maxMb} МБ`;
  return null;
}

export function imageExt(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

// Уменьшает картинку по длинной стороне и сохраняет в WebP.
// Если результат получился не легче оригинала, возвращает оригинал.
export async function compressImage(file: File, maxSide: number, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (!blob || blob.type !== "image/webp") return file;
  if (scale === 1 && blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}