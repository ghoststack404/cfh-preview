# Rutas API

Cada ruta recibe una acción pequeña: valida la sesión, valida los datos y llama a la lógica compartida. Evita convertir estos archivos en bloques enormes; las reglas que también usaría una app móvil pertenecen en `src/lib`.

Las acciones que cambian información verifican el origen de la solicitud. Los permisos siempre se revisan en el servidor, aunque el botón también esté oculto en la interfaz.
