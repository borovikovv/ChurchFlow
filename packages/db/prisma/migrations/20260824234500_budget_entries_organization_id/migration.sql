-- budget_entries досі не мала організації: вона посилалась на місяць і на категорію,
-- кожна зі своєю, і ніщо на рівні бази не заважало звести в один рядок дві різні.
-- Тримала це лише перевірка в коді (assertMonthAndCategory).

-- Якщо такі рядки вже існують, композитний ключ нижче все одно впаде,
-- але з незрозумілим повідомленням. Краще зупинитись тут і сказати, що саме не так.
DO $$
DECLARE
  mismatched bigint;
BEGIN
  SELECT count(*) INTO mismatched
  FROM "budget_entries" be
  JOIN "budget_months" bm ON bm."id" = be."month_id"
  JOIN "budget_categories" bc ON bc."id" = be."category_id"
  WHERE bm."organization_id" <> bc."organization_id";

  IF mismatched > 0 THEN
    RAISE EXCEPTION
      'budget_entries: % рядків зводять місяць і категорію різних організацій; розберіться з ними до застосування міграції',
      mismatched;
  END IF;
END $$;

ALTER TABLE "budget_entries" ADD COLUMN "organization_id" UUID;

UPDATE "budget_entries" be
SET "organization_id" = bm."organization_id"
FROM "budget_months" bm
WHERE bm."id" = be."month_id";

ALTER TABLE "budget_entries" ALTER COLUMN "organization_id" SET NOT NULL;

-- Композитний зовнішній ключ потребує унікальності саме цієї пари в батька.
CREATE UNIQUE INDEX "budget_months_id_organization_id_key"
  ON "budget_months"("id", "organization_id");

CREATE UNIQUE INDEX "budget_categories_id_organization_id_key"
  ON "budget_categories"("id", "organization_id");

-- Одноколонкові ключі замінюються композитними: тепер організація рядка мусить збігатися
-- з організацією і місяця, і категорії одночасно, інакше рядок просто не запишеться.
ALTER TABLE "budget_entries" DROP CONSTRAINT "budget_entries_month_id_fkey";
ALTER TABLE "budget_entries" DROP CONSTRAINT "budget_entries_category_id_fkey";

ALTER TABLE "budget_entries"
  ADD CONSTRAINT "budget_entries_month_id_organization_id_fkey"
  FOREIGN KEY ("month_id", "organization_id") REFERENCES "budget_months"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_entries"
  ADD CONSTRAINT "budget_entries_category_id_organization_id_fkey"
  FOREIGN KEY ("category_id", "organization_id") REFERENCES "budget_categories"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "budget_entries_month_id_organization_id_idx"
  ON "budget_entries"("month_id", "organization_id");

CREATE INDEX "budget_entries_category_id_organization_id_idx"
  ON "budget_entries"("category_id", "organization_id");
