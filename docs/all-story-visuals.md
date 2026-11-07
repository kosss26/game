# Complete published story visuals

All six currently published stories now have full cast and photo-message coverage.
The integration uses the existing resolved message text and character names;
no scripts, snapshot versions, branch conditions or player progress are changed.

| Story | Human portraits | Anonymous/system icons | Photo occurrences |
| --- | ---: | ---: | ---: |
| Тихий час | 3 | 0 | 0 |
| Белый шум | 7 | 1 | 9 |
| Отложенные сообщения | 9 | 2 | 9 |
| 04:44 | 6 | 0 | 9 |
| Северное сияние | 8 | 1 | 10 |
| Не спится | 10 | 4 | 7 |
| Total | 43 | 8 | 44 |

Added 37 portrait WebPs and 20 scene/detail WebPs. The six main portraits and
two initial photographs remain in use. All images are locally served, compressed
and loaded through the existing attachment viewer. Atlas originals are retained
outside the repository; exports only split, resize and encode the generated art.

The 44 photo occurrences represent 38 distinct authored captions. Physical
photographs use 21 photo assets (including the existing two); an additional
background is used for the envelope. Repeated boat/zucchini/chess/telemetry clues
resolve consistently rather than inventing a new image for each occurrence.

Documents, receipts, phone messages and badges are readable native cards using
exact resolved scenario text. The postcard greeting and camera date are interface
text layers, not unreliable generated lettering. Chess is a clear board diagram
with a threatened white queen, glasses and white to move. Captions remain visible
in full. Anonymous contacts and bots get appropriate symbols, not human faces.

Two sensitive scene images are marked as scene illustrations: they show a neutral
room/window-watch detail or a non-graphic garage fragment rather than literal
restraint/injury detail. Original story descriptions remain intact. The rest of
the generated images are fictional story illustrations, not documentary photos.

Forwarded photo messages now render their nested attachment instead of exposing
raw `[фото]` text. Viewer controls, focus return and captions work for those
attachments too. Unknown future captions still fall back to their text; they are
never silently assigned an unrelated picture.

Coverage tests enumerate every published character and photo line, check local
asset existence, both gender variants and resolved player names, anonymity, and
reused evidence. Browser checks cover all 43 portrait files, all 38 caption types,
forwarded photos, document themes and chess, modal dismissal, and 320/390/430 px
layouts. Full suite: 166 tests, plus a focused exact-document-text regression test.
Final production build excludes the temporary local review gallery.

Deploy using the existing hostkey.sh update. No bot setup, database migration or
Cloudflare changes are needed. Gameplay and native startup behavior are untouched.
