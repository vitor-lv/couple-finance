-- Remove as colunas espelho de transactions.
-- As colunas amount/category/description eram cópias de valor/categoria/descricao,
-- mantidas por "compatibilidade" sem uso real. O código já foi atualizado para
-- parar de escrevê-las. Esta migration remove as colunas do banco.
ALTER TABLE transactions
  DROP COLUMN IF EXISTS amount,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS description;
