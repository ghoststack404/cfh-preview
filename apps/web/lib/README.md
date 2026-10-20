# Lógica compartida

Esta carpeta reúne autenticación, permisos, comisiones, chat seguro, OpenAI, Stripe, Twilio, correo, PDFs y auditoría.

- `business.ts`: 15% LATAM, 25% global, planes y niveles.
- `payments.ts`: cliente Stripe y estado de cuentas Connect.
- `ai.ts`: generador local y OpenAI Responses API.
- `mail.ts`: SMTP local o de producción.
- `chat.ts`: detección de contacto antes del pago.

Cuando una regla cambie, actualiza también sus pruebas y la trazabilidad del requisito.
