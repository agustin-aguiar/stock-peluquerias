# Preparación del alta autoservicio

## Qué cambia

- Una persona crea una cuenta en `/registro`, confirma el correo y crea su cadena. Recibe el rol de administrador de **esa nueva cadena**; el navegador no puede asignar roles ni escoger una cadena existente.
- El administrador crea locales y usuarios desde la aplicación. Al guardar un usuario nuevo, una función privada envía una invitación de Supabase Auth. Si el correo falla, el perfil queda creado y se puede reintentar desde Usuarios.
- Una dirección de correo pertenece a una sola cadena. Esto coincide con el modelo actual de un perfil por cuenta Auth. Invitar a la misma persona a varias cadenas requeriría un modelo de membresías distinto.
- Se puede pedir un producto aún sin primera carga en el local solicitante. Cuando el local origen acepta, el destino se habilita con cantidad cero; la cantidad enviada solo se suma al confirmar la recepción. Un pedido rechazado por el origen puede volver a asignarse.
- «Sin primera carga» deja de contar como «agotado» o «stock bajo» en alertas y tablero.

## Orden de activación en producción

1. Preparar un proyecto Supabase **de pruebas**, aplicar `0015_requests_alerts.sql` y `0016_self_service_chains.sql` y ejecutar `npm run test:db`. No usar producción como base de pruebas automatizadas.
2. Verificar antes de `0016` que ningún correo aparezca en perfiles de dos cadenas: el nuevo índice global rechazará duplicados. Resolverlos explícitamente, sin borrar perfiles a ciegas.
3. Aplicar las dos migraciones en producción y comprobar que la tabla `stock_requests`, las funciones `create_my_chain`, `review_stock_request`, `request_stock`, `decide_stock_request` y la vista `inventory_status` responden.
4. En Supabase Authentication, habilitar el registro por correo, mantener **Confirm email** activo y exigir al menos 10 caracteres de contraseña. Agregar `https://stock-peluquerias.vercel.app/sin-perfil` y `https://stock-peluquerias.vercel.app/auth/restablecer` a Redirect URLs; mantener también los orígenes de desarrollo que correspondan.
5. Confirmar que Vercel Production tiene `SUPABASE_URL` o `VITE_SUPABASE_URL` y `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` para `/api/invite-user`. Son variables del servidor; ninguna clave privada debe tener prefijo `VITE_`. `PUBLIC_APP_URL` puede fijarse a `https://stock-peluquerias.vercel.app`.
6. Publicar el frontend y la función. Con un correo nuevo, completar registro → confirmación → creación de cadena → creación de local → invitación → contraseña del encargado → acceso al local. Probar además que un encargado no puede crear otra cadena ni invitar usuarios de otra.

## Validación disponible en este checkout

Las pruebas unitarias, TypeScript y ESLint se pueden ejecutar sin credenciales. Las pruebas de base agregadas cubren el primer producto solicitado para un local y el alta de cadena, pero requieren `.env.test.local` con un proyecto Supabase aislado. El envío real de una invitación requiere el SMTP de Supabase y las variables privadas en Vercel.

## Riesgos a vigilar al abrir el registro

- El registro público permite crear cadenas nuevas. Revisar límites de Auth, volumen de correos y, si aparece abuso, activar protección contra bots en Supabase Auth.
- Las invitaciones dependen del límite de envío del SMTP configurado. Probar entrega y reintento antes de anunciar el servicio.
- El respaldo y una restauración completa en otro proyecto siguen pendientes de la etapa de piloto.
