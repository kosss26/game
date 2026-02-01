-- Добавление пользователя в админы
-- Telegram ID: 1763619724

-- Шаг 1: Создаём пользователя (если ещё не существует)
INSERT INTO users (telegram_id, first_name, username)
VALUES (1763619724, 'Admin', 'admin')
ON CONFLICT (telegram_id) DO NOTHING;

-- Шаг 2: Добавляем в админы
INSERT INTO admin_users (user_id, role)
SELECT id, 'admin'
FROM users
WHERE telegram_id = 1763619724
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Проверка
SELECT u.id, u.telegram_id, u.first_name, a.role
FROM users u
JOIN admin_users a ON a.user_id = u.id
WHERE u.telegram_id = 1763619724;
