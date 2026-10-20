# Cuenta y sesión

Aquí están registro, acceso, cierre de sesión y recuperación de contraseña. La cookie contiene un token aleatorio; PostgreSQL conserva únicamente su hash.

La recuperación crea un token de un solo uso, guarda su hash, invalida solicitudes anteriores y vence en 30 minutos. En local, Mailpit recibe el mensaje en `http://localhost:8025`. En producción, SMTP debe apuntar al dominio verificado.

Al modificar estos flujos, prueba cuentas suspendidas, enumeración de correos, enlaces vencidos, reutilización de token y cierre de sesiones después del cambio.
