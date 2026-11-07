/** Only local, authored assets are allowed in story media references. */
export function storyPhoto(description: string, source?: string): string | null {
  if (source && /^\/story-media\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(source)) return source;
  if (description === 'Кабачок размером с небольшую торпеду лежит на табуретке. Рядом для масштаба — кот Барсик, недовольный') return '/story-media/zucchini.webp';
  if (description === 'Особняк Зелинского вечером. Все окна второго этажа горят, на ступенях красная дорожка, у входа швейцар с зонтом. На тротуаре блестят лужи с отражениями фонарей') return '/story-media/mansion.webp';
  return null;
}

export const CHARACTER_PORTRAITS: Record<string,string> = {
  'Ася':'/portraits/asya.webp', 'Лера':'/portraits/lera.webp', 'Фёдор Ковалёв':'/portraits/fyodor.webp',
  'Мира':'/portraits/mira.webp', 'Антон':'/portraits/anton.webp', 'Ника':'/portraits/nika.webp',
};
