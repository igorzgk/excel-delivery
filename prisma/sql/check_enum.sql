SELECT e.enumlabel
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'AuditAction'
ORDER BY e.enumsortorder;
