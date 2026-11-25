-- ==============================================================================
-- FINOVA AI — ROLE TOPIC SCOPE FOR KNOWLEDGE BASE DOCUMENTS
-- Migration ID: 20261132_role_topic_document_access
--
-- Sets which roles can retrieve each policy document through the AI Assistant:
--   Common (all roles) : General Information for All Users
--   Support & customer : support SLA, account closure, KYC documents
--                        -> ADMIN, SUPPORT_EXECUTIVE, CUSTOMER
--   Fraud              : fraud handling, AML escalation, wire approvals
--                        -> ADMIN, FINANCE_ANALYST
-- ADMIN can always read every document in its tenant.
--
-- Only touches documents with these exact titles; safe to re-run. Run it after
-- uploading the policies (scripts/ingest_policy_docs.ts). Documents uploaded
-- later by the script already get these roles.
-- ==============================================================================

UPDATE public.ai_knowledge_documents
SET allowed_roles = ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE_ANALYST', 'SUPPORT_EXECUTIVE', 'CUSTOMER'],
    updated_at = now()
WHERE title = 'General Information for All Users';

UPDATE public.ai_knowledge_documents
SET allowed_roles = ARRAY['ADMIN', 'SUPPORT_EXECUTIVE', 'CUSTOMER'],
    updated_at = now()
WHERE title IN (
    'Customer Support SLA and Complaint Handling',
    'Account Closure Policy',
    'KYC Document Requirements'
);

UPDATE public.ai_knowledge_documents
SET allowed_roles = ARRAY['ADMIN', 'FINANCE_ANALYST'],
    updated_at = now()
WHERE title IN (
    'Fraud Case Handling Procedure',
    'Anti-Money Laundering (AML) Escalation Policy',
    'Wire Transfer Approval Controls'
);

-- Result: documents and who can see them
SELECT title, array_to_string(allowed_roles, ', ') AS allowed_roles, status, chunk_count
FROM public.ai_knowledge_documents
WHERE status <> 'ARCHIVED'
ORDER BY title;
