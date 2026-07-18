# Acceso y marca del workspace

La autenticación no concede acceso a la aplicación. El acceso requiere una membresía `active`; las solicitudes pendientes o rechazadas y las membresías suspendidas o revocadas permanecen bloqueadas.

El nombre y el logo se guardan en `workspace_settings`. El cliente escucha cambios por Realtime y usa `logo_version` para invalidar caché en la interfaz, favicon y manifest dinámico.

## Limitación PWA

Los sistemas operativos pueden conservar el icono de una PWA ya instalada aunque cambie el manifest. El nuevo icono se verá al actualizar o reinstalar la PWA, según el caché y las reglas del dispositivo.
