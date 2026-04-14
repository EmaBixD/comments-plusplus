-- TODO: Ottimizzare l'indice della tabella
SELECT * FROM users
WHERE last_login < '2023-01-01';

-- FIXME: Non c'è la colonna note
UPDATE users
SET is_active = false
WHERE note IS NULL;

-- Falsi positivi (stringhe e nomi tabelle)
SELECT id, 'todo' AS alias FROM items;
DESCRIBE todo_table;
