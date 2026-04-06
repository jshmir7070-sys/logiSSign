BEGIN;

UPDATE storage.buckets
SET public = false
WHERE id IN ('contracts', 'documents', 'education', 'seals');

DROP POLICY IF EXISTS "storage_contracts_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_education_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_seals_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_contracts_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_education_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_seals_insert" ON storage.objects;

DROP POLICY IF EXISTS "storage_contracts_select_scoped" ON storage.objects;
CREATE POLICY "storage_contracts_select_scoped"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'contracts'
  AND (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR (
      (storage.foldername(name))[1] = 'templates'
      AND EXISTS (
        SELECT 1
        FROM contract_templates t
        WHERE t.id::text = split_part(storage.filename(name), '.', 1)
          AND (
            t.agency_id IS NULL
            OR t.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
          )
      )
    )
    OR (
      (storage.foldername(name))[1] IN ('signed', 'audit')
      AND EXISTS (
        SELECT 1
        FROM contracts c
        WHERE c.id::text = split_part(storage.filename(name), '_', 1)
          AND (
            c.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
            OR c.driver_id IN (
              SELECT id
              FROM drivers
              WHERE user_id = auth.uid()
            )
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "storage_contracts_insert_scoped" ON storage.objects;
CREATE POLICY "storage_contracts_insert_scoped"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'contracts'
  AND (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR (
      (storage.foldername(name))[1] = 'templates'
      AND EXISTS (
        SELECT 1
        FROM contract_templates t
        WHERE t.id::text = split_part(storage.filename(name), '.', 1)
          AND (
            t.agency_id IS NULL
            OR t.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "storage_documents_select_scoped" ON storage.objects;
CREATE POLICY "storage_documents_select_scoped"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR (
      (storage.foldername(name))[1] = 'driver-docs'
      AND EXISTS (
        SELECT 1
        FROM drivers d
        WHERE d.id::text = (storage.foldername(name))[2]
          AND d.user_id = auth.uid()
      )
    )
    OR (
      (storage.foldername(name))[1] = 'signed-documents'
      AND EXISTS (
        SELECT 1
        FROM document_deliveries dd
        WHERE dd.id::text = split_part(storage.filename(name), '_', 1)
          AND (
            dd.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
            OR dd.driver_id IN (
              SELECT id
              FROM drivers
              WHERE user_id = auth.uid()
            )
          )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM document_files df
      WHERE df.file_url = name
        AND (
          df.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
          OR EXISTS (
            SELECT 1
            FROM document_deliveries dd
            WHERE dd.document_file_id = df.id
              AND dd.driver_id IN (
                SELECT id
                FROM drivers
                WHERE user_id = auth.uid()
              )
          )
        )
    )
  )
);

DROP POLICY IF EXISTS "storage_documents_insert_scoped" ON storage.objects;
CREATE POLICY "storage_documents_insert_scoped"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR (
      (storage.foldername(name))[1] = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')
      AND (auth.jwt()->'app_metadata'->>'role') = 'agency_admin'
    )
    OR (
      (storage.foldername(name))[1] = 'driver-docs'
      AND EXISTS (
        SELECT 1
        FROM drivers d
        WHERE d.id::text = (storage.foldername(name))[2]
          AND d.user_id = auth.uid()
      )
    )
    OR (
      (storage.foldername(name))[1] = 'signed-documents'
      AND EXISTS (
        SELECT 1
        FROM document_deliveries dd
        WHERE dd.id::text = split_part(storage.filename(name), '_', 1)
          AND dd.driver_id IN (
            SELECT id
            FROM drivers
            WHERE user_id = auth.uid()
          )
      )
    )
  )
);

DROP POLICY IF EXISTS "storage_education_select_scoped" ON storage.objects;
CREATE POLICY "storage_education_select_scoped"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'education'
  AND (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR EXISTS (
      SELECT 1
      FROM education_records er
      JOIN drivers d ON d.id = er.driver_id
      WHERE er.certificate_number = split_part(storage.filename(name), '.', 1)
        AND (
          d.user_id = auth.uid()
          OR d.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
        )
    )
  )
);

DROP POLICY IF EXISTS "storage_education_insert_scoped" ON storage.objects;
CREATE POLICY "storage_education_insert_scoped"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'education'
  AND (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR EXISTS (
      SELECT 1
      FROM education_records er
      JOIN drivers d ON d.id = er.driver_id
      WHERE er.certificate_number = split_part(storage.filename(name), '.', 1)
        AND d.agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
    )
  )
);

DROP POLICY IF EXISTS "sign_fields_select" ON document_sign_fields;
CREATE POLICY "sign_fields_select" ON document_sign_fields
FOR SELECT
USING (
  (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
  OR document_file_id IN (
    SELECT id
    FROM document_files
    WHERE agency_id = NULLIF(auth.jwt()->'app_metadata'->>'agency_id', '')::uuid
  )
  OR document_file_id IN (
    SELECT dd.document_file_id
    FROM document_deliveries dd
    WHERE dd.document_file_id IS NOT NULL
      AND dd.driver_id IN (
        SELECT id
        FROM drivers
        WHERE user_id = auth.uid()
      )
  )
);

COMMIT;
