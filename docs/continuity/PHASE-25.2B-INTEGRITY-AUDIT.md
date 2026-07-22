# Fase 25.2B — Auditoría de integridad e identidad

Estado: artefactos preparados; auditoría real de datos pendiente de ejecución explícita.

## Alcance

La fase cubre `quotes`, `production_orders`, `purchases` y `purchase_items`. Inspecciona identidad, aislamiento por workspace, referencias padre y referencias comerciales sin modificar almacenamiento local o remoto.

Los módulos de auditoría reciben colecciones y producen hallazgos estructurados. El auditor remoto usa el cliente publishable existente, respeta RLS y solo se ejecuta cuando un consumidor invoca explícitamente `auditRemoteIntegrity`.

La lectura remota refleja únicamente las filas visibles para la sesión autenticada y sus políticas RLS. Un resultado vacío no demuestra por sí solo que la tabla o el proyecto estén limpios.

## Reglas

- `id` debe ser UUID válido y es la identidad técnica.
- `workspace_id` debe estar presente.
- Las relaciones se resuelven por UUID y dentro del mismo workspace.
- Folios, números de orden y `source_id` son referencias comerciales; no fusionan entidades.
- Un folio duplicado se informa como `warning` y requiere evaluar las reglas de negocio existentes.
- Ningún hallazgo dispara correcciones automáticas.

## Clasificación de hallazgos

Errores de bloqueo:

- `missing_id`, `invalid_uuid`, `duplicate_id` y `duplicate_workspace_entity`.
- `missing_workspace_id`.
- `missing_parent`, `orphan_reference` y `workspace_mismatch`.
- `malformed_record`.

Advertencias:

- `duplicate_commercial_reference`.
- Tablas remotas no disponibles, permisos insuficientes o consultas parciales.

Información:

- Registros presentes únicamente en la colección local o en la lectura remota.

## Riesgo y reparación legacy

| Riesgo | Tratamiento permitido en 25.2B |
|---|---|
| UUID ausente o inválido | Reportar. La asignación requiere revisión humana y mapa de equivalencias. |
| UUID duplicado | Conservar todos los registros. Determinar manualmente procedencia y relaciones. |
| Workspace ausente o incorrecto | Reportar. Validar propietario y membresía antes de corregir. |
| Relación huérfana | Reportar. Identificar padre real o decidir archivado mediante proceso separado. |
| Folio duplicado | Advertir. No fusionar ni elegir una entidad por folio. |
| Registro local/remoto divergente | Comparar por UUID; no sobrescribir automáticamente. |

La creación de índices, una vez validada la ausencia de infracciones, puede automatizarse en una migración revisada. Ninguna reparación de datos legacy debe automatizarse sin un mapa aprobado de UUID, workspace y padres.

## Condiciones antes de restricciones

1. Ejecutar auditoría local con las colecciones reales cargadas.
2. Ejecutar auditoría remota autenticada para cada workspace relevante.
3. Obtener reporte `clean` y readiness compatible con la restricción propuesta.
4. Revisar manualmente folios duplicados y diferencias local/remoto.
5. Ejecutar las consultas previas del SQL preview y guardar resultados.
6. Confirmar que catálogo, migrations y entorno remoto coinciden.
7. Aprobar respaldo, ventana de cambio y responsable del rollback.

No debe afirmarse que la base está limpia hasta completar estos pasos. Estado actual de datos: `Pendiente de validación`.

## Estrategia de respaldo

- Confirmar un respaldo remoto recuperable anterior a la ventana de migración.
- Exportar un snapshot de solo lectura, acotado por workspace, de las cuatro tablas.
- Registrar conteos y checksums del snapshot sin incluir secretos.
- Conservar una copia de los datos locales antes de cualquier futura reparación.
- Verificar el procedimiento de restauración en un entorno no productivo.

## Estrategia de rollback

- Separar reparación de datos, creación de índices y validación de FK en migraciones distintas.
- Agregar FK inicialmente como `NOT VALID` únicamente en una fase autorizada futura.
- Validar constraints en una migración posterior tras repetir la auditoría.
- Si una restricción afecta operación, retirar únicamente el artefacto nuevo mediante una migración compensatoria revisada; no restaurar datos por folio.
- Restaurar datos solo desde el respaldo aprobado y mediante un procedimiento explícito.

## Orden recomendado futuro

1. Congelar escrituras durante la ventana autorizada.
2. Crear respaldo y registrar conteos.
3. Reparar UUID/workspace con mapa humano aprobado.
4. Reparar padres en orden: Quotes → Production → Purchases → Purchase Items.
5. Repetir auditoría local, remota y comparación.
6. Crear índices de soporte faltantes.
7. Agregar constraints `NOT VALID` donde aplique.
8. Validar constraints.
9. Repetir pruebas funcionales, Realtime y workflow.
10. Habilitar escrituras y conservar plan de rollback.

## Artefactos

- `src/lib/identity/auditLocalIntegrity.js`
- `src/lib/identity/auditRemoteIntegrity.js`
- `src/lib/identity/buildIntegrityReport.js`
- `supabase/migrations-prepared/25_2b_identity_constraints.preview.sql`

El SQL es exclusivamente una vista previa. No pertenece al historial ejecutable de Supabase y no fue aplicado.
