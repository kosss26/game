/** Catalog categories stay broad; editorial subtitles remain on story cards. */
export function catalogGenre(value?: string | null): string {
  if (!value) return "";
  if (/детектив/iu.test(value)) return "Детектив";
  if (/триллер/iu.test(value)) return "Триллер";
  return value.split("·")[0].trim();
}
