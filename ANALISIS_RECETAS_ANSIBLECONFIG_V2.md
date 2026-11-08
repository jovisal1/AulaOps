# Comparación con ansibleConfig_v2

Análisis estático de los seis playbooks y el archivo de variables de `../ansibleConfig_v2/Playbooks`, contrastado con las seis recetas integradas, sus playbooks y las validaciones de Aula Ansible. Se han comprobado también los archivos de apoyo. No se han ejecutado los playbooks ni añadido instalaciones.

## Playbooks que faltan

Hay cuatro playbooks sin equivalente en el catálogo actual. Para mantener el diseño de recetas individuales, sus tareas pueden separarse en estas diez acciones:

| Acción pendiente | Origen y tarea | Alcance observado |
| --- | --- | --- |
| Instalar MySQL Workbench | `3_instalacion_workbench_docker.yml:9` | Instalación con Snap, gnome-keyring y conexiones a password-manager-service y ssh-keys. |
| Instalar Docker | `3_instalacion_workbench_docker.yml:14` | Dependencias, clave de firma, repositorio y docker-ce. |
| Crear un contenedor MySQL | `3_instalacion_workbench_docker.yml:47` | Contenedor mysql-db, puerto 33060 hacia 3306 y configuración de la contraseña root. |
| Instalar MongoDB | `4_instalacion_mongo.yml:10` | Dependencias, clave de firma, repositorio e instalación de mongodb-org 8.0. El origen no incluye una tarea explícita para habilitar/iniciar mongod. |
| Instalar MongoDB Compass | `4_instalacion_mongo.yml:52` | Descarga de un paquete .deb de versión 1.46.2 y arquitectura amd64, instalación y limpieza. |
| Instalar PHP y extensiones | `5_instalacion_xampp.yml:9` | Paquetes php, php-cli y php-mysql del sistema. |
| Instalar y configurar XAMPP | `5_instalacion_xampp.yml:17` | Instalación desatendida desde un .run ya presente en el escritorio, ajustes de php.ini y reinicio mediante handler. |
| Instalar Composer | `5_instalacion_xampp.yml:60` | Comprobación SHA-384 del instalador e instalación en /usr/local/bin/composer. |
| Importar una base de datos SQL | `5_instalacion_xampp.yml:77` | Arranque de MariaDB de XAMPP e importación de un script SQL con su cliente mysql. |
| Apagar equipos y comprobar el apagado | `6_apagar_pcs.yml:9` | Shutdown remoto y espera desde el controlador hasta que el puerto SSH deje de responder. |

La receta de SQL debería distinguir entre el servidor de XAMPP y el contenedor MySQL: el origen importa exclusivamente mediante el cliente de XAMPP. La receta del contenedor depende de Docker; las conexiones de Workbench dependen de Snap. El origen da por disponibles algunas de estas dependencias.

## Funciones parcialmente cubiertas

### Usuario y copia de ficheros

`1_creacion_usuario_copia_ficheros.yml` combina creación de usuario, pertenencia a sudo y copia de archivos. La creación de cuenta y sudo ya existen en `playbooks/user.yml`.

Falta la copia de **archivos individuales** al escritorio. La receta `folders.yml` solo admite directorios: `validate_run` rechaza las rutas que no cumplen `is_dir()`. El origen usa `files_to_copy` para copiar tres ZIP de LMSGI; los tres existen en la carpeta de materiales. Puede añadirse una receta de archivos independiente o ampliarse la copia con una lista separada, sin mezclarla con la creación de cuentas.

El usuario configurado en el origen contiene una mayúscula; las validaciones actuales de Aula Ansible solo permiten nombres en minúsculas. Reutilizar literalmente esa configuración provocaría un rechazo.

### VS Code

La instalación de extensiones y la escritura de settings.json ya existen en `playbooks/vscode.yml`, con valores configurables mediante variables globales y el asistente.

Falta la creación de `code.desktop` en el escritorio, presente en `2_configuracion_vs_code.yml:61`.

El origen configura extensiones adicionales —Live Server, Red Hat Java, un generador de getters/setters y Prettier— y ajustes específicos para Java, HTML, CSS y JavaScript. El proyecto ya puede configurarlos: son valores o un posible perfil de configuración, no recetas nuevas.

## Variables y herramientas ya cubiertas

- `0_variables_comunes.yml` tiene un equivalente en las variables globales actuales. La correspondencia principal es `username` → `aula_user`; `files_to_copy` necesitaría una variable nueva para archivos individuales. La contraseña del origen se sustituiría por el mecanismo temporal del asistente.
- `listar_ips.sh` ya tiene equivalente funcional en el descubrimiento automático. Existe una diferencia de alcance: el script usa `nmap -sn` para localizar IP activas; Aula Ansible busca servicios SSH y excluye las direcciones locales del controlador. Un equipo encendido sin SSH podría aparecer en el script y no en la aplicación.
- Las recetas actuales de Java, prueba SSH/sudo y eliminación de usuarios no tienen un playbook dedicado equivalente en el directorio analizado; deben conservarse.

## Correcciones necesarias antes de incorporar el código

1. **Archivo de variables incorrecto:** el playbook 3 referencia `variables_comunes.yml`, pero el archivo disponible se llama `0_variables_comunes.yml`.
2. **Dependencias de XAMPP ausentes:** el playbook espera `xampp-linux-x64-8.2.12-0-installer.run` y `crear_db.sql` en el escritorio. Ninguno aparece entre los archivos del directorio analizado. Sí existen `FicherosACopiar/BD/jardineria.sql` y `ventas_exam.sql`; pueden ofrecerse como materiales seleccionables, pero no son el archivo referenciado por la receta.
3. **Repositorios y arquitecturas fijos:** Docker apunta a Ubuntu focal; MongoDB, a Ubuntu jammy; Compass usa amd64 y XAMPP, x64. No están vinculados a la distribución y arquitectura detectadas en el destino. No se ha comprobado aquí la disponibilidad actual de esas versiones ni su compatibilidad con el LliureX de destino.
4. **Privilegios incoherentes:** varias instalaciones de sistema se ejecutan con `become_user: username`. XAMPP además cambia a ese usuario mediante `su`. La adaptación debe distinguir instalación como root y configuración de archivos como usuario del aula.
5. **Credenciales literales:** hay una contraseña en el archivo común y otra en la orden de creación del contenedor. Sus valores se omiten en este informe. No deben trasladarse a los archivos globales ni a argumentos registrados; deben integrarse con el tratamiento temporal de credenciales de la aplicación.
6. **Reejecución:** la creación del contenedor es una orden docker run con `ignore_errors`; la importación SQL es una orden shell sin control de estado. Además, los SQL incluidos contienen CREATE DATABASE sin IF NOT EXISTS. Debe definirse qué hacer si ya existen el contenedor o la base de datos.
7. **Apagado:** la espera usa el puerto 22 y `ansible_ssh_host`. La adaptación debe usar el puerto y la dirección de la ejecución y tener su propia confirmación antes del apagado.
8. **Formato de importación:** estos archivos son playbooks completos, algunos con handlers y vars_files. El diálogo actual de recetas personalizadas admite listas de tareas, por lo que no pueden pegarse directamente sin adaptar esas referencias y handlers o ampliar el importador.

## Resultado

Pendientes: **diez acciones de cuatro playbooks ausentes**, **dos funciones adicionales de recetas parcialmente cubiertas** y, opcionalmente, un perfil de configuración de VS Code. Este informe identifica el alcance; la incorporación debe conservar playbooks individuales, variables configurables, validación y revisión previa desde el asistente.
