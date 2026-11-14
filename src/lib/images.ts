export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function checkImage(file: File, maxMb: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Нужна картинка JPG, PNG или WebP";
  if (file.size > maxMb * 1024 * 1024) return `Файл больше ${maxMb} МБ`;
  return null;
}

export function imageExt(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}