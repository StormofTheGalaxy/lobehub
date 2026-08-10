-- ============================================================================
-- Откат схемы БД к состоянию тега v0.1.12 (8ed7ea89,
-- 116 файлов миграций / 115 записей в drizzle journal).
--
-- Отменяет 21 миграцию (0115..0135), накатившуюся с PR #6 и #8.
-- Все 21 — чисто аддитивные по схеме: ни одного DROP COLUMN, ни одной
-- удалённой ранее существовавшей таблицы. Поэтому откат детерминирован.
--
-- ЧТО ЭТОТ СКРИПТ НЕ ВЕРНЁТ (читать до запуска):
--
--   1. Данные в 23 удаляемых таблицах и 37 удаляемых колонках. Комментарии к
--      топикам, проекты, метки агентов, квоты, acceptances, work-реестр,
--      workspace_user_settings, notifications.context/workspace_id,
--      agents.name, api_keys.scopes — всё это исчезнет вместе с объектами.
--
--   2. Роли owner, понижённые бэкфиллом миграции 0129. Скрипт снимает
--      уникальный индекс, но НЕ знает, кто из нынешних admin был owner до
--      бэкфилла — эта информация нигде не сохранена. Восстанавливается
--      только из бэкапа, снятого до деплоя.
--
--   3. Побочные UPDATE'ы миграций: devices.visibility, acceptances.visibility,
--      verify_runs.visibility были проставлены по умолчанию; исходные NULL
--      не восстанавливаются (колонки удаляются целиком, так что для отката
--      это неважно).
--
-- Транзакционно: при любой ошибке откатывается целиком, БД не остаётся
-- в промежуточном состоянии.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback_to_v0.1.12.sql
--
-- Перед запуском СНИМИТЕ БЭКАП:
--   pg_dump "$DATABASE_URL" -Fc -f before_rollback.dump
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Таблицы, созданные миграциями 0117..0134.
--    CASCADE снимает их внешние ключи, индексы и зависимые ограничения.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "project_completion_reviews" CASCADE;
DROP TABLE IF EXISTS "project_knowledge_bases"    CASCADE;
DROP TABLE IF EXISTS "project_chat_groups"        CASCADE;
DROP TABLE IF EXISTS "project_agents"             CASCADE;
DROP TABLE IF EXISTS "projects"                   CASCADE;

DROP TABLE IF EXISTS "agent_history_job_topics"   CASCADE;
DROP TABLE IF EXISTS "agent_history_job_agents"   CASCADE;
DROP TABLE IF EXISTS "agent_history_jobs"         CASCADE;

DROP TABLE IF EXISTS "agent_label_assignments"    CASCADE;
DROP TABLE IF EXISTS "agent_labels"               CASCADE;

DROP TABLE IF EXISTS "agent_quota_usage_ledger"   CASCADE;
DROP TABLE IF EXISTS "agent_quota_calibrations"   CASCADE;
DROP TABLE IF EXISTS "agent_quota_snapshots"      CASCADE;
DROP TABLE IF EXISTS "agent_quota_windows"        CASCADE;
DROP TABLE IF EXISTS "agent_account_bindings"     CASCADE;
DROP TABLE IF EXISTS "agent_provider_accounts"    CASCADE;

DROP TABLE IF EXISTS "topic_comment_mentions"     CASCADE;
DROP TABLE IF EXISTS "topic_comments"             CASCADE;

DROP TABLE IF EXISTS "work_versions"              CASCADE;
DROP TABLE IF EXISTS "works"                      CASCADE;

DROP TABLE IF EXISTS "resource_permissions"       CASCADE;
DROP TABLE IF EXISTS "workspace_user_settings"    CASCADE;
DROP TABLE IF EXISTS "acceptances"                CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Индексы на ранее существовавших таблицах.
--    Те, что лежали на удалённых выше таблицах, ушли вместе с ними.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "workspace_members_unique_active_owner_idx";  -- 0129
DROP INDEX IF EXISTS "agents_created_at_idx";                      -- 0125
DROP INDEX IF EXISTS "topics_created_at_idx";                      -- 0125
DROP INDEX IF EXISTS "messages_topic_id_updated_at_idx";           -- 0125
DROP INDEX IF EXISTS "idx_notifications_user_workspace";           -- 0128
DROP INDEX IF EXISTS "idx_notifications_workspace_id";             -- 0128
DROP INDEX IF EXISTS "tasks_project_id_status_idx";                -- 0134
DROP INDEX IF EXISTS "oidc_clients_user_id_idx";                   -- 0120
DROP INDEX IF EXISTS "oidc_clients_workspace_id_idx";              -- 0120
DROP INDEX IF EXISTS "verify_runs_acceptance_id_idx";              -- 0119
DROP INDEX IF EXISTS "verify_runs_acceptance_round_unique";        -- 0119
DROP INDEX IF EXISTS "verify_runs_user_decision_idx";              -- 0122
DROP INDEX IF EXISTS "messenger_account_links_platform_tenant_application_unique"; -- 0123
DROP INDEX IF EXISTS "user_connectors_agent_id_idx";               -- 0123
DROP INDEX IF EXISTS "user_connectors_agent_identifier_idx";       -- 0123
DROP INDEX IF EXISTS "user_connectors_personal_identifier_idx";    -- 0123
DROP INDEX IF EXISTS "user_connectors_workspace_identifier_idx";   -- 0123

-- visibility-индексы (0115)
DROP INDEX IF EXISTS "agents_workspace_visibility_idx";
DROP INDEX IF EXISTS "chat_groups_workspace_visibility_idx";
DROP INDEX IF EXISTS "devices_workspace_visibility_idx";
DROP INDEX IF EXISTS "documents_workspace_visibility_idx";
DROP INDEX IF EXISTS "files_workspace_visibility_idx";
DROP INDEX IF EXISTS "generation_topics_workspace_visibility_idx";
DROP INDEX IF EXISTS "knowledge_bases_workspace_visibility_idx";
DROP INDEX IF EXISTS "session_groups_workspace_visibility_idx";
DROP INDEX IF EXISTS "task_comments_workspace_visibility_idx";
DROP INDEX IF EXISTS "task_deps_workspace_visibility_idx";
DROP INDEX IF EXISTS "task_docs_workspace_visibility_idx";
DROP INDEX IF EXISTS "task_topics_workspace_visibility_idx";
DROP INDEX IF EXISTS "tasks_workspace_visibility_idx";

-- ---------------------------------------------------------------------------
-- 3. Индекс, который миграция 0123 удалила, заменив своими. На теге он был —
--    возвращаем, иначе после отката потеряется уникальность (user_id, identifier).
--    Два других DROP'а в 0123 (agent_identifier_unique,
--    user_identifier_agent_null_unique) на теге не существовали — это были
--    защитные no-op'ы, восстанавливать нечего.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "user_connectors_user_identifier_unique"
  ON "user_connectors" USING btree ("user_id", "identifier");

-- ---------------------------------------------------------------------------
-- 4. Колонки, добавленные к ранее существовавшим таблицам.
--    Колонки новых таблиц ушли вместе с таблицами в шаге 1.
-- ---------------------------------------------------------------------------
ALTER TABLE "agents"                   DROP COLUMN IF EXISTS "name";
ALTER TABLE "agents"                   DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "api_keys"                 DROP COLUMN IF EXISTS "scopes";
ALTER TABLE "chat_groups"              DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "devices"                  DROP COLUMN IF EXISTS "shared_from_device_id";
ALTER TABLE "devices"                  DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "documents"                DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "files"                    DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "generation_topics"        DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "knowledge_bases"          DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "messenger_account_links"  DROP COLUMN IF EXISTS "application_id";
ALTER TABLE "messenger_account_links"  DROP COLUMN IF EXISTS "credentials";
ALTER TABLE "notifications"            DROP COLUMN IF EXISTS "context";
ALTER TABLE "notifications"            DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "oidc_clients"             DROP COLUMN IF EXISTS "enabled";
ALTER TABLE "oidc_clients"             DROP COLUMN IF EXISTS "last_used_at";
ALTER TABLE "oidc_clients"             DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "oidc_clients"             DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "session_groups"           DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "task_comments"            DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "task_dependencies"        DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "task_documents"           DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "task_topics"              DROP COLUMN IF EXISTS "trigger";
ALTER TABLE "task_topics"              DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "tasks"                    DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "tasks"                    DROP COLUMN IF EXISTS "visibility";
ALTER TABLE "user_connectors"          DROP COLUMN IF EXISTS "agent_id";
ALTER TABLE "verify_check_results"     DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "verify_check_results"     DROP COLUMN IF EXISTS "user_decision_detail";
ALTER TABLE "verify_evidence"          DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "verify_runs"              DROP COLUMN IF EXISTS "acceptance_id";
ALTER TABLE "verify_runs"              DROP COLUMN IF EXISTS "decision_detail";
ALTER TABLE "verify_runs"              DROP COLUMN IF EXISTS "round_index";
ALTER TABLE "verify_runs"              DROP COLUMN IF EXISTS "user_decision";
ALTER TABLE "verify_runs"              DROP COLUMN IF EXISTS "visibility";

-- ---------------------------------------------------------------------------
-- 5. Журнал drizzle: снять записи 21 миграции, иначе старое приложение
--    посчитает их применёнными и не накатит заново.
--
--    Миграции определяются по created_at (folderMillis) — drizzle сравнивает
--    именно его, а не хеш.
--
--    Граница взята из _journal.json: последняя миграция тега — 0114 с
--    when=1782009459420 (21 июня), первая лишняя — 0115 с when=1782954350516
--    (2 июля). Удаляем строго то, что новее 0114.
-- ---------------------------------------------------------------------------
DELETE FROM "drizzle"."__drizzle_migrations" WHERE created_at > 1782009459420;

-- Контроль: на теге v0.1.12 в journal ровно 115 записей (136 сейчас − 21).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "drizzle"."__drizzle_migrations";
  IF n <> 115 THEN
    RAISE EXCEPTION 'Ожидалось 115 применённых миграций после отката, получено %. Откат отменён.', n;
  END IF;
END $$;

COMMIT;
