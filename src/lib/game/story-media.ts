import { PHOTO_CATALOG, type StoryVisual } from "./visual-catalog";

/** Resolve approved local sources and exact/static-prefix published captions. */
export function storyVisual(description: string, source?: string): StoryVisual | null {
  if (source && /^\/story-media\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(source)) return {kind: "photo", src: source};
  return PHOTO_CATALOG.find(item => description.startsWith(item.match)) || null;
}

export function storyPhoto(description: string, source?: string): string | null {
  const visual = storyVisual(description, source);
  return visual?.kind === "photo" ? visual.src : null;
}

export const CHARACTER_PORTRAITS: Record<string,string> = {
  'Ася':'/portraits/asya.webp', 'Лера':'/portraits/lera.webp', 'Фёдор Ковалёв':'/portraits/fyodor.webp',
  'Мира':'/portraits/mira.webp', 'Антон':'/portraits/anton.webp', 'Ника':'/portraits/nika.webp',
  "Глеб": "/portraits/gleb.webp",
  "В. А. Лавров": "/portraits/lavrov.webp",
  "Марк": "/portraits/mark.webp",
  "Дима": "/portraits/dima.webp",
  "Кира": "/portraits/kira.webp",
  "Полина": "/portraits/polina.webp",
  "Тёма": "/portraits/tema.webp",
  "Степан Ильич": "/portraits/stepan.webp",
  "Костя": "/portraits/kostya.webp",
  "Марина": "/portraits/marina.webp",
  "Дядя Рома": "/portraits/roman.webp",
  "Стас": "/portraits/stas.webp",
  "Варя": "/portraits/varya.webp",
  "Алла": "/portraits/alla.webp",
  "Тётя Зина": "/portraits/zina.webp",
  "Е. Д. Гарин": "/portraits/garin.webp",
  "Т. Валиев": "/portraits/valiev.webp",
  "Е. М. Гуров": "/portraits/gurov.webp",
  "Даня": "/portraits/dania.webp",
  "Бабушка Галя": "/portraits/baba.webp",
  "Соня": "/portraits/sonya.webp",
  "Г. А. Штерн": "/portraits/shtern.webp",
  "Лис": "/portraits/alisa.webp",
  "Гоша": "/portraits/gosha.webp",
  "Бахрам": "/portraits/bakhram.webp",
  "Профессор": "/portraits/prof.webp",
  "Пётр Ильич": "/portraits/savelyev.webp",
  "Коллекционер": "/portraits/sholts.webp",
  "Груздев": "/portraits/gruzdev.webp",
  "Вадик": "/portraits/vadik.webp",
  "Ирина Соколова": "/portraits/sokolova.webp",
  "А. Л. Ремез": "/portraits/remez.webp",
  "Рустам · такси": "/portraits/rustam.webp",
  "Нина Павловна": "/portraits/nina.webp",
  "kir_47": "/portraits/kirill.webp",
  "Дед Матвей": "/portraits/matvey.webp",
  "Оля · ночная смена": "/portraits/olya.webp",

};

/** Intentionally anonymous/system identities never receive invented human faces. */
export const CHARACTER_ICONS: Record<string, 'user' | 'phone' | 'file' | 'lock' | 'sparkle'> = {
  'Неизвестный номер':'phone', 'Слушатель':'user', 'Наталья_К':'user', 'Сергей1975':'user',
  'Хранитель':'file', 'Таблетница Pro':'sparkle', 'Цербер':'lock', 'Архив эфиров':'file',
};
