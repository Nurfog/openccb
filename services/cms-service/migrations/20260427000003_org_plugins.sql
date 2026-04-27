-- Fase 35: Ecosistema de Plugins
-- Tabla de plugins registrados por organización

CREATE TABLE IF NOT EXISTS org_plugins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    component_url   TEXT NOT NULL,
    icon_url        TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_plugins_org_id ON org_plugins(organization_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_org_plugins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_plugins_updated_at
    BEFORE UPDATE ON org_plugins
    FOR EACH ROW EXECUTE FUNCTION update_org_plugins_updated_at();
