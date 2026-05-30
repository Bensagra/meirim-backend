# Auth + Roles — Guía de deploy

Se agregó un sistema de **cuentas con DNI + contraseña** y **roles** (Miembro, Editor de
Fotos, Admin de Actividades, Super Admin). Esto requiere una migración de base de
datos y un par de variables de entorno.

## 1) Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Para qué | Ejemplo |
|---|---|---|
| `AUTH_SECRET` | Firma los tokens de sesión. **Obligatoria en producción.** Usá una cadena larga y aleatoria. | `openssl rand -hex 32` |
| `ADMIN_BOOTSTRAP_SECRET` | Permite crear el primer Super Admin (ver paso 3). Borrala después de usarla. | una cadena secreta cualquiera |

> Si `AUTH_SECRET` no está, el backend usa un secreto de desarrollo (no seguro) y lo avisa por consola.

## 2) Migración de la base de datos

Ya quedó creada la carpeta de migración `prisma/migrations/20260530120000_add_auth_roles/`.

En producción, aplicá la migración:

```bash
npx prisma migrate deploy
```

(En local/dev podés usar `npx prisma migrate dev`.) Después regenerá el cliente si hace falta:

```bash
npx prisma generate
```

La migración agrega a la tabla `User`: `password`, `role` (default `MIEMBRO`),
`nickname`, `bio`, `accentColor`, `instagram`, `phone`, `createdAt`, `updatedAt`.
Es segura sobre datos existentes: las personas ya cargadas quedan como `MIEMBRO`
y **sin contraseña** (cuentas "sin reclamar").

## 3) Crear el primer Super Admin

1. Entrá al sitio → **Ingresar → Crear cuenta** y registrate con tu DNI.
   (Si tu DNI ya existía de antes, el registro lo "reclama" y le pone contraseña.)
2. Promové esa cuenta a Super Admin. Dos opciones:

   **a) Vía endpoint de bootstrap** (necesita `ADMIN_BOOTSTRAP_SECRET`):
   ```bash
   curl -X POST https://meirim-backend.vercel.app/api/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -H "x-bootstrap-secret: TU_ADMIN_BOOTSTRAP_SECRET" \
     -d '{"dni":"TU_DNI"}'
   ```

   **b) Vía SQL** (en el panel de tu Postgres):
   ```sql
   UPDATE "User" SET role = 'SUPER_ADMIN' WHERE dni = 'TU_DNI';
   ```

3. Volvé a iniciar sesión (o recargá) y ya vas a ver el **Panel** con la sección
   **Usuarios**, desde donde asignás roles al resto sin tocar más la base.

## Roles y qué desbloquean

| Rol | Acceso |
|---|---|
| **Miembro** | Planificar actividades, votar, jugar, y su perfil personalizable. |
| **Editor de Fotos** | + subir/ordenar las galerías (sección Fotos del panel). |
| **Admin de Actividades** | + actividades, Mesaza, 100 Meirimers, Nominaciones. |
| **Super Admin** | Todo + gestión de usuarios y asignación de roles. |

## Notas

- El frontend manda el token en el header `Authorization: Bearer ...` automáticamente.
- Tokens válidos por 30 días; al vencer, se pide iniciar sesión de nuevo.
- Las fotos de avatar usan el mismo bucket de Supabase que las galerías (carpeta `avatars/`).
