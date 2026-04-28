# Security Triage

Fecha de última actualización: 2026-04-28 (P2+P3 completados)

---

## Estado actual (post-remediación)

### Rust (cargo audit)
- Vulnerabilidades: 4 (todas en dependencias transitivas via AWS SDK, sin fix directo)
- Warnings: 1

#### Vulnerabilidades activas

1. RUSTSEC-2023-0071 (rsa 0.9.9)

   #### Nota sobre lru (nuevo)
   - RUSTSEC-2026-0104 (lru 0.12.5): IterMut viola Stacked Borrows
   - Cadena: aws-sdk-s3 → lru
   - Bloqueado por AWS SDK. Monitorear con `cargo update && cargo audit`.
   - Severidad: media (Marvin Attack)
   - Cadena: sqlx-mysql → rsa
   - Fix upstream: no disponible
   - Estado: aceptación de riesgo temporal

2. RUSTSEC-2026-0098 (rustls-webpki 0.101.7)
   - Nombre: RUSTSEC-2026-0098 URI name constraints incorrectly accepted
   - Cadena: aws-sdk-s3/aws-config → aws-smithy-http-client → rustls 0.21 → rustls-webpki 0.101.7
   - Fix: requiere AWS SDK 1.x actualice su stack TLS a rustls >=0.22
   - Estado: bloqueado por tercero (AWS SDK)

3. RUSTSEC-2026-0099 (rustls-webpki 0.101.7)
   - Nombre: RUSTSEC-2026-0099 wildcard name constraints incorrectly accepted
   - Misma cadena que 0098

4. RUSTSEC-2026-0104 (rustls-webpki 0.101.7)
   - Nombre: RUSTSEC-2026-0104 panic alcanzable en CRL parsing
   - Misma cadena que 0098

#### Nota: openidconnect ya NO es un vector
- Se actualizó openidconnect de 3.5 → 4.x
- openidconnect 4.x usa reqwest 0.12 + rustls-webpki 0.103.13 (parcheado) ✓
- Código de handlers SSO actualizado para nueva API (reqwest::Client en lugar de async_http_client)

---

### Frontend (npm audit --omit=dev)

#### Studio
- Pre-remediación: 1 critical, 12 high, 1 moderate (total 14)
- Post-remediación: **0 high**, 4 moderate (total 4) ✅
- Resuelto: mermaid upgrade (9→11.14.0), xlsx eliminado (parseo movido a backend Rust con calamine), Next.js 14→15.5.15
- Restante moderate: postcss bundled en Next (sin fix sin downgrade), uuid via mermaid (sin fix sin downgrade mermaid)

#### Experience
- Pre-remediación: 1 critical, 11 high, 1 moderate (total 13)
- Post-remediación: **0 high**, 4 moderate (total 4) ✅
- Resuelto: mermaid upgrade, Next.js 14→15.5.15
- Restante moderate: postcss bundled en Next, uuid via mermaid (mismas restricciones que studio)

---

## Bugs corregidos (colaterales al triage)

- Studio: función PeerReviewDashboard duplicada en peer-reviews/page.tsx (compilación OK)
- Experience: PeerReviewPlayer duplicada en blocks/PeerReviewPlayer.tsx (compilación OK)
- Experience: try sin catch en handleBlockComplete de lessons/[lessonId]/page.tsx
- Backend: variable err_body no usada en handlers LMS (warning eliminado)

---

## Plan de remediación restante

### P1 (pendiente - bloqueado por terceros)
- rustls-webpki via AWS SDK: monitorear release del AWS SDK que actualice a rustls 0.22+
  - Validar con: cargo update && cargo audit
  - ETA: depende de AWS SDK Rust team

### P2 (decisión de producto)
- xlsx en studio: sin fix disponible en npm
  - Opción A: encapsular parseo de Excel en backend y eliminar xlsx del frontend
  - Opción B: documentar excepción + limitar tamaño y tipo de archivos subidos

### P3 (pendiente)
- Next.js major upgrade (14.x → 15.x o superior con fix)
  - Requiere checklist de breaking changes de Next
  - Validar: rutas, middleware, auth flows, SSR
  - Recomendado ejecutar en rama separada con suite E2E completa

