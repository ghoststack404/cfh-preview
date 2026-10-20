# Base de datos

`schema.prisma` describe usuarios, coaches, reservas, chat, pagos, suscripciones, IA y cursos.

Para desarrollo:

```bash
npm run db:migrate -- --name nombre-del-cambio
npm run db:seed
```

Para producción:

```bash
npm run db:deploy
```

No uses `db push` como proceso normal de producción porque no deja un historial revisable de cambios.
