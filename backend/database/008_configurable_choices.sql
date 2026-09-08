DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname,conrelid::regclass AS tbl FROM pg_constraint WHERE contype='c' AND conrelid IN ('animals'::regclass,'milk'::regclass,'health'::regclass,'breeding'::regclass,'tasks'::regclass,'buyers'::regclass,'staff'::regclass,'inventory'::regclass) AND pg_get_constraintdef(oid) LIKE '%ANY (ARRAY%' LOOP
 EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.tbl,c.conname);
 END LOOP;
END $$;
