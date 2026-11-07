import { storyPhoto } from '../story-media';

test('accepts local authored media and rejects remote and traversing sources', () => {
  expect(storyPhoto('Caption','/story-media/evidence.webp')).toBe('/story-media/evidence.webp');
  for (const path of ['https://evil.invalid/x.jpg','//evil.invalid/x.jpg','/story-media/../secret.jpg','javascript:alert(1)','/story-media/photo.svg']) expect(storyPhoto('Caption',path)).toBeNull();
});
test('preserves descriptions without substituting unrelated imagery',()=>{
  expect(storyPhoto('A vital clue described only in text')).toBeNull();
});
