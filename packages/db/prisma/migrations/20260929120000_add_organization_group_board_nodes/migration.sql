-- Shared positions of the nodes on the groups board, one row per organization and node. The node
-- key is a group id or a computed node key, so it carries no foreign key to organization_groups.

-- CreateTable
CREATE TABLE "organization_group_board_nodes" (
    "organization_id" UUID NOT NULL,
    "node_key" VARCHAR(64) NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_group_board_nodes_pkey" PRIMARY KEY ("organization_id","node_key")
);

-- CreateIndex
CREATE INDEX "organization_group_board_nodes_updated_by_user_id_idx" ON "organization_group_board_nodes"("updated_by_user_id");

-- AddForeignKey
ALTER TABLE "organization_group_board_nodes" ADD CONSTRAINT "organization_group_board_nodes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_group_board_nodes" ADD CONSTRAINT "organization_group_board_nodes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
