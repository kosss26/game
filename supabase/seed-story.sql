-- Seed data: Sample story for demonstration
-- Run this after schema.sql

-- Insert sample story
INSERT INTO stories (id, title, description, cover_style, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 
   'Тайна тёмного офиса', 
   'Ваш первый день на новой работе оборачивается чем-то странным...', 
   'noir', 
   'published');

-- Insert day 1
INSERT INTO days (id, story_id, day_number, title, estimated_minutes, status, meta) VALUES
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   1,
   'Первый день',
   25,
   'published',
   '{"background_style": "noir", "recap_text": "Что-то странное происходит в этом офисе..."}');

-- Note: Scenes and choices would be created via the Script Importer in admin panel
-- Below is the sample script that can be imported via admin UI:

/*
SAMPLE DAY SCRIPT - Copy this to the Script Importer:

[bg noir]

SYS: День 1. Первый рабочий день.

...
NPC: Добро пожаловать в "Темников и Партнёры"! #tag:start

...
NPC: Я Марина, ваш HR-менеджер.

[delay 300ms]
ME: Приятно познакомиться!

...
NPC: Как я могу к вам обращаться?

INPUT: Введите ваше имя -> goto after_name [set name_asked=true]

NPC: Отличное имя! Идём, покажу офис. #tag:after_name

[pause 2s]

SYS: Марина ведёт вас по длинному коридору...

...
NPC: Здесь у нас open space. Ваше место будет в дальнем углу.

...
ME: А почему там никого нет?

[typing 2000ms]
NPC: О... Там раньше сидел Игорь. Он... больше не работает.

...
NPC: Не обращайте внимания. Идёмте дальше.

CHOICE:
- Спросить про Игоря -> goto ask_igor [set curious=true]
- Просто кивнуть -> goto continue [set polite=true]

NPC: Это... сложная тема. Может, потом расскажу. #tag:ask_igor
...
NPC: Лучше продолжим экскурсию.

NPC: Хорошо, вот здесь кухня. #tag:continue

...
NPC: Можете брать кофе и чай. Бесплатно.

[pause 1s]

...
ME: Спасибо, это приятно.

...
NPC: Да, мы стараемся создать уютную атмосферу.

[typing 1500ms]
NPC: Несмотря на... обстоятельства.

...
ME: Какие обстоятельства?

...
NPC: Ой, не слушайте меня. Просто устала.

CHOICE:
- Вы можете мне рассказать -> goto trust [set builds_trust=true]
- Понимаю, все устают -> goto polite_response

NPC: Может быть... позже. Когда узнаем друг друга лучше. #tag:trust
...
NPC: Вы первый, кто спрашивает.

NPC: Да, неделя была тяжёлая. #tag:polite_response
...
NPC: Ладно, пойдёмте к вашему рабочему месту.

[pause 3s]

SYS: Вы подходите к своему столу в углу офиса...

...
NPC: Вот ваш компьютер. Логин и пароль на листочке.

...
ME: Спасибо.

...
NPC: Если что-то понадобится — я на втором этаже.

...
NPC: И... будьте осторожны.

...
ME: В смысле?

[typing 2500ms]
NPC: Просто... не задерживайтесь после шести. Особенно в пятницу.

...
NPC: До встречи!

SYS: Марина быстро уходит. Вы остаётесь одни.

[pause 5s]

...
NPC: Странное начало...

SYS: Вы садитесь за компьютер и начинаете работать.

[pause 3s]

...
NPC: Ладно, разберёмся.

...
ME: Посмотрим, что здесь происходит.

SYS: Вы открываете рабочую почту...

[typing 1200ms]
SYS: В папке "Входящие" одно непрочитанное письмо.

...
SYS: Тема: "ВАЖНО! Прочитай до конца дня"

...
SYS: Отправитель: igor.petrov@temnikov.ru

...
ME: Игорь? Тот самый?

CHOICE:
- Открыть письмо сразу -> goto open_email [set opened_email=true]
- Сначала осмотреться -> goto look_around [set careful=true]

SYS: Вы открываете письмо... #tag:open_email

[typing 2000ms]
SYS: "Если ты это читаешь — беги. Не оставайся после 18:00. Никогда."

...
SYS: "Они следят. Они везде."

...
SYS: "Я попытался уйти. Не смог."

...
SYS: "P.S. Не говори Марине."

...
ME: Что за...?

SYS: Продолжение следует...

SYS: Вы осматриваете офис... #tag:look_around

...
SYS: На столе — старый блокнот с заметками.

...
SYS: "Пятница 18:00 — НЕ ОСТАВАТЬСЯ"

...
SYS: Подчёркнуто красным. Трижды.

...
ME: Что здесь происходит?

[pause 2s]

SYS: В почте мигает непрочитанное письмо...

...
SYS: От какого-то Игоря.

CHOICE:
- Прочитать письмо -> goto read_email_later
- Пока оставить -> goto ignore_email [set ignored_warning=true]

SYS: Вы открываете письмо... #tag:read_email_later

[typing 1500ms]
SYS: "Если ты это читаешь — беги..."

SYS: Вы решаете разобраться с этим позже. #tag:ignore_email

...
SYS: Может, это просто шутка нового коллектива.

SYS: Продолжение следует...

*/
