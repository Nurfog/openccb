-- Create organization_email_templates table
CREATE TABLE organization_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    is_html BOOLEAN NOT NULL DEFAULT false,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, template_key)
);

-- Create index for faster lookups
CREATE INDEX idx_org_email_templates_org_key ON organization_email_templates(organization_id, template_key);

-- Insert default templates for common system events
INSERT INTO organization_email_templates (organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled)
SELECT
    o.id as organization_id,
    'forum_reply' as template_key,
    'Notificación de respuesta en foro' as display_name,
    'Nueva respuesta en {{thread_title}}' as subject_template,
    'Hola {{recipient_name}},

Ha recibido una nueva respuesta en el hilo "{{thread_title}}" por {{author_name}}.

Mensaje:
{{message_content}}

Ver hilo completo: {{thread_url}}

Saludos,
El equipo de {{organization_name}}' as body_template,
    false as is_html,
    true as is_enabled
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_email_templates
    WHERE organization_id = o.id AND template_key = 'forum_reply'
);

INSERT INTO organization_email_templates (organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled)
SELECT
    o.id as organization_id,
    'forum_thread' as template_key,
    'Notificación de nuevo hilo en foro' as display_name,
    'Nuevo hilo en foro: {{thread_title}}' as subject_template,
    'Hola {{recipient_name}},

Se ha creado un nuevo hilo en el foro: "{{thread_title}}" por {{author_name}}.

Mensaje inicial:
{{message_content}}

Ver hilo: {{thread_url}}

Saludos,
El equipo de {{organization_name}}' as body_template,
    false as is_html,
    true as is_enabled
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_email_templates
    WHERE organization_id = o.id AND template_key = 'forum_thread'
);

INSERT INTO organization_email_templates (organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled)
SELECT
    o.id as organization_id,
    'welcome_student' as template_key,
    'Bienvenida a estudiantes' as display_name,
    'Bienvenido a {{organization_name}}' as subject_template,
    'Hola {{student_name}},

Bienvenido a {{organization_name}}! Has sido inscrito en el curso "{{course_name}}".

Puedes acceder al curso aquí: {{course_url}}

Si tienes alguna pregunta, no dudes en contactarnos.

Saludos,
El equipo de {{organization_name}}' as body_template,
    false as is_html,
    true as is_enabled
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_email_templates
    WHERE organization_id = o.id AND template_key = 'welcome_student'
);

INSERT INTO organization_email_templates (organization_id, template_key, display_name, subject_template, body_template, is_html, is_enabled)
SELECT
    o.id as organization_id,
    'grade_notification' as template_key,
    'Notificación de calificaciones' as display_name,
    'Nueva calificación en {{lesson_name}}' as subject_template,
    'Hola {{student_name}},

Has recibido una nueva calificación en la lección "{{lesson_name}}" del curso "{{course_name}}".

Calificación: {{grade}}/{{max_grade}}
Comentarios: {{comments}}

Ver detalles: {{lesson_url}}

Saludos,
El equipo de {{organization_name}}' as body_template,
    false as is_html,
    true as is_enabled
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM organization_email_templates
    WHERE organization_id = o.id AND template_key = 'grade_notification'
);