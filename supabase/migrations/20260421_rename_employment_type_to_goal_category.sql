-- Renomeia employment_type para goal_category.
-- O campo foi reaproveitado durante o desenvolvimento para armazenar a categoria
-- da meta financeira (reserva_emergencia, viagem, casa_propria, etc.), mas manteve
-- o nome antigo. Esta migration alinha o nome da coluna com seu uso real.
ALTER TABLE users RENAME COLUMN employment_type TO goal_category;
