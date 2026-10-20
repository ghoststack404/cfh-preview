# Stripe

`connect` crea o continúa una cuenta Express, actualiza su estado al regresar y permite abrir el panel del coach. `webhook` es la fuente de verdad para pagos, suscripciones, reembolsos y cuentas conectadas.

Las sesiones y cursos usan destination charges: la plataforma fija `application_fee_amount` y el destino del coach. Un ID `acct_mock_...` nunca debe enviarse a Stripe real.

No confirmes un pago porque el navegador volvió a una página de éxito. La confirmación debe llegar firmada por webhook y registrarse en `StripeEvent` para evitar procesarla dos veces.
