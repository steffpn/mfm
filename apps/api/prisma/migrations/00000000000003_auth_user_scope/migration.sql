-- CreateTable: user_scopes (UserScope join table for multi-entity scoping)
CREATE TABLE "user_scopes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,

    CONSTRAINT "user_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on (user_id, entity_type, entity_id)
CREATE UNIQUE INDEX "user_scopes_user_id_entity_type_entity_id_key" ON "user_scopes"("user_id", "entity_type", "entity_id");

-- CreateIndex: index on user_id for fast lookups
CREATE INDEX "user_scopes_user_id_idx" ON "user_scopes"("user_id");

-- AddForeignKey: user_scopes.user_id -> users.id with cascade delete
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MigrateData: copy any existing scopeId values from users to user_scopes before dropping
-- Uses role as entity_type for migration (ARTIST -> artist, LABEL -> label, STATION -> station)
INSERT INTO "user_scopes" ("user_id", "entity_type", "entity_id")
SELECT "id", LOWER("role"), "scope_id"
FROM "users"
WHERE "scope_id" IS NOT NULL;

-- AlterTable: remove scope_id from users
ALTER TABLE "users" DROP COLUMN "scope_id";

-- AlterTable: drop redeemed_by FK constraint first
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_redeemed_by_id_fkey";

-- AlterTable: drop redeemed_by_id unique index
DROP INDEX IF EXISTS "invitations_redeemed_by_id_key";

-- AlterTable: remove redeemed_by_id and redeemed_at from invitations
ALTER TABLE "invitations" DROP COLUMN IF EXISTS "redeemed_by_id";
ALTER TABLE "invitations" DROP COLUMN IF EXISTS "redeemed_at";

-- AlterTable: add max_uses and used_count to invitations
ALTER TABLE "invitations" ADD COLUMN "max_uses" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "invitations" ADD COLUMN "used_count" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey: refresh_tokens.user_id -> users.id with cascade delete
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
