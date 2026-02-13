-- CreateTable
CREATE TABLE "routing_decisions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymous_id" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "task_type" TEXT,
    "stakes" TEXT,
    "input_signals" JSONB,
    "selected_model" TEXT,
    "routing_intent" TEXT,
    "routing_category" TEXT,
    "routing_confidence" DOUBLE PRECISION,
    "expected_success" INTEGER,
    "confidence" TEXT,
    "key_factors" JSONB,
    "models_compared" JSONB,
    "diff_summary" JSONB,
    "verdict" TEXT,

    CONSTRAINT "routing_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routing_decisions_anonymous_id_idx" ON "routing_decisions"("anonymous_id");

-- CreateIndex
CREATE INDEX "routing_decisions_mode_idx" ON "routing_decisions"("mode");

-- CreateIndex
CREATE INDEX "routing_decisions_selected_model_idx" ON "routing_decisions"("selected_model");

-- CreateIndex
CREATE INDEX "routing_decisions_task_type_idx" ON "routing_decisions"("task_type");

-- CreateIndex
CREATE INDEX "routing_decisions_created_at_idx" ON "routing_decisions"("created_at");
