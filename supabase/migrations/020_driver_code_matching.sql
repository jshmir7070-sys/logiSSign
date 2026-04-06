ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS driver_code TEXT;

WITH driver_prefixes AS (
  SELECT
    d.id,
    SUBSTRING(
      UPPER(
        REGEXP_REPLACE(
          COALESCE(NULLIF(a.invite_code, ''), a.name, 'DRV') || 'DRV',
          '[^A-Za-z0-9]',
          '',
          'g'
        )
      )
      FROM 1 FOR 3
    ) AS prefix,
    ROW_NUMBER() OVER (
      PARTITION BY d.agency_id
      ORDER BY d.created_at NULLS FIRST, d.id
    ) AS seq
  FROM drivers d
  LEFT JOIN agencies a ON a.id = d.agency_id
  WHERE d.driver_code IS NULL
)
UPDATE drivers d
SET driver_code = driver_prefixes.prefix || '-' || LPAD(driver_prefixes.seq::TEXT, 6, '0')
FROM driver_prefixes
WHERE d.id = driver_prefixes.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_agency_driver_code_unique
  ON drivers (agency_id, driver_code)
  WHERE driver_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_agency_employee_code_unique
  ON drivers (agency_id, LOWER(employee_code))
  WHERE employee_code IS NOT NULL;
