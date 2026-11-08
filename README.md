# Aula Ansible · LliureX

Aplicación local con interfaz web en castellano y valenciano, temas claro y oscuro y playbooks incluidos. La interfaz usa React, Tailwind CSS y componentes oficiales de shadcn/ui. La red IPv4 se detecta automáticamente a partir de la conexión activa del equipo; no es necesario escribir un rango. Ejecuta primero **Probar conexión y sudo** en un PC.

## Puesta en marcha

En el equipo de control LliureX, descomprime el ZIP y ejecuta con tu usuario normal:

```bash
cd aula-ansible
python3 iniciar.py
```

El lanzador utiliza solo Python estándar, que debe estar instalado previamente. Abre automáticamente **http://127.0.0.1:8764**; si el navegador no se abre, introduce esa dirección. Comprueba las dependencias y, si falta alguna, muestra una ventana con **Instalar y preparar**. Puedes introducir la contraseña sudo del PC de control (vacía si sudo es NOPASSWD). Después ejecuta sin más preguntas `apt-get update`, instala `python3-venv`, `openssh-client`, `sshpass` e `iproute2`, crea `.venv` e instala `requirements.txt` con pip. La contraseña se entrega a sudo por stdin y no se guarda.

Se muestra el progreso por etapas y la salida de cada paso, incluidos errores de sudo, APT o pip. Al terminar la instalación se abre la aplicación automáticamente. Si ya estaba preparada, pulsa **Abrir aplicación**. El asistente también sirve en posteriores arranques: si las dependencias ya están preparadas no vuelve a instalarlas. Si cambia requirements.txt ofrece preparar sus nuevas versiones. No uses sudo para iniciar el lanzador y mantén la terminal abierta; no cierres el instalador mientras APT esté trabajando. Los registros del instalador son locales y temporales; evita incluir credenciales en URLs de repositorios o configuración de pip.

La instalación automática requiere conexión a los repositorios de LliureX y PyPI, permisos sudo y una sesión de escritorio para abrir el navegador. No instala dependencias en los PCs del aula: eso corresponde a las recetas seleccionadas.

Como alternativa, instalación manual en el equipo de control:

```bash
sudo apt update
sudo apt install python3 python3-venv openssh-client sshpass iproute2
cd aula-ansible
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abre **http://127.0.0.1:8765** en ese mismo equipo. No ejecutes la aplicación con sudo. No la expongas a Internet ni cambies la dirección de escucha. Python 3.11 o posterior; las recetas están orientadas a LliureX de 64 bits con APT y cuentas locales. La versión exacta y paquetes disponibles se deben comprobar en un PC real antes del despliegue general.

El equipo de control necesita acceso a PyPI para instalar dependencias. Los PCs necesitan acceso a sus repositorios APT y, para VS Code/extensiones, a Microsoft y Visual Studio Marketplace. Los destinos requieren Python 3 y SSH operativo. No se instala ni configura SSH remotamente.

## Antes de ejecutar: verificar las claves SSH

Desde el mismo usuario que iniciará la aplicación, conecta una vez a cada PC:

```bash
ssh profesor@192.168.1.10
# Si usas un puerto distinto:
ssh -p 2222 profesor@192.168.1.10
```

Contrasta la huella con la del equipo de destino antes de aceptarla. Así se registra en `~/.ssh/known_hosts`. La aplicación no acepta automáticamente claves nuevas ni desactiva su comprobación. Si el PC ha sido reinstalado, comprueba la nueva huella antes de actualizar la entrada.

## Flujo de trabajo

1. Abre **Equipos**. La aplicación detecta automáticamente las redes privadas IPv4 del equipo y selecciona la conexión preferida según su ruta de red. Si tienes varias conexiones activas, elige la que corresponde al aula. No necesitas introducir el rango. Puedes cambiar el puerto SSH.
2. Pulsa **Descubrir**: se buscan banners SSH en la subred real de esa conexión, excluyendo las IP del propio equipo de control. Se admiten hasta 65.536 direcciones por exploración automática; las redes grandes pueden tardar varios minutos. **Actualizar redes** vuelve a detectar las conexiones si has cambiado de aula. Si no se detecta ninguna red o no aparecen equipos, se despliega **Introducir rango manualmente**: escribe un CIDR y pulsa **Buscar en este rango** (hasta 1024 direcciones). También puedes abrir esta opción voluntariamente o añadir IP sueltas. Se omiten las interfaces de bucle local, las desconectadas y las interfaces habituales de contenedores y VPN. La exploración no autentica ni identifica la distribución.
3. Selecciona los equipos. **Guardar hosts.yml** sustituye el inventario de esta instalación, con copia automática del anterior. Redescubrir por sí solo no modifica el archivo. El inventario se guarda en `data/hosts.yml`.
4. Abre **Lanzar recetas**. El asistente tiene cuatro pasos: seleccionar recetas, completar parámetros y conexión SSH, revisar y ejecutar, y consultar los logs. Solo muestra los parámetros de las recetas elegidas; al volver atrás conserva los valores.
5. En los parámetros, indica tu usuario SSH. Usa tu agente SSH, una clave privada local (o desbloqueada con `ssh-add`), o una contraseña SSH. Si sudo solicita contraseña, introdúcela por separado. Si sudo es NOPASSWD, deja su campo vacío. Para la primera prueba selecciona solo **Probar conexión y sudo**.
6. Revisa los equipos, recetas y parámetros antes de pulsar **Ejecutar ahora**. Los logs se abren automáticamente: se agrupan por IP, con filtros y descarga de resumen JSON. Muestran tareas, fecha, mensajes, stdout, stderr y código de salida cuando Ansible los proporciona.

Si existe `data/hosts.yml`, **Inicio** muestra su número de equipos, puerto y una muestra de IP. Puedes continuar con ese inventario sin generarlo otra vez. **Lanzar recetas** solo está disponible con equipos seleccionados; **Logs** requiere además que haya comenzado una ejecución en esta sesión. Al deseleccionar todos los equipos, ambos apartados se deshabilitan.

En la cabecera, el icono del globo permite cambiar entre castellano y valenciano; el de sol/luna alterna el tema claro y oscuro. Estas preferencias se conservan en el navegador. Las contraseñas no se almacenan con ellas. Las tareas YAML, los nombres y descripciones de recetas propias y las salidas originales de Ansible conservan su contenido.

Las ejecuciones usan la selección visible; no es obligatorio guardar el inventario para lanzarlas. No mezcles equipos de aulas distintas accidentalmente: revisa las IP antes de confirmar. Un único trabajo activo por instalación. Las tareas se aplican en lotes de 10 PCs. Un fallo en un equipo no revierte cambios en él ni en otros equipos.

## Recetas incluidas

- **Usuario:** cuenta local con `/bin/bash`, home y grupo `sudo`. La contraseña se transforma en hash SHA-512 localmente. De forma predeterminada solo se aplica a cuentas nuevas; marca la opción correspondiente para cambiarla en cuentas existentes. No se concede sudo sin contraseña. Usa un nombre local que no colisione con cuentas de dominio.
- **Java:** instala `openjdk-N-jdk` mediante APT (21 por defecto). Debe existir en los repositorios de tu versión. No elimina otras JDK ni fuerza `update-alternatives` si ya hay varias.
- **VS Code:** instala el paquete oficial `code` desde el repositorio HTTPS de Microsoft con clave de firma acotada al repositorio. Instala extensiones que falten mediante el CLI como el usuario de aula. No elimina ni actualiza expresamente extensiones existentes. Sustituye `~/.config/Code/User/settings.json`, con copia de seguridad si cambia. El JSON debe ser válido, sin comentarios. Si el aula ya tiene un repositorio de Microsoft con otra configuración `Signed-By`, unifica esa configuración antes de ejecutar esta receta.
- **Carpetas:** las rutas pertenecen al equipo donde corre `app.py`, no al navegador ni al PC remoto. Copia cada carpeta conservando su nombre al escritorio XDG del usuario; para cuentas nuevas sin configuración crea `~/Escritorio` y registra esa ubicación. Conserva archivos adicionales del destino y respalda archivos modificados. Si el escritorio está deshabilitado o fuera del home, la tarea se detiene para que revises su ubicación. Para volúmenes muy grandes conviene adaptar la receta a rsync.

El usuario de destino debe existir si ejecutas VS Code o carpetas sin seleccionar también la receta de creación. Se admiten homes locales bajo `/home/`; los usuarios y escritorios centralizados de un modelo de aula LliureX requieren adaptación específica.

## Eliminar usuarios por username

Selecciona **Eliminar usuario por username**, escribe el nombre exacto y elige los PCs. La eliminación debe ejecutarse por separado de las recetas de configuración (puede combinarse con la prueba de conexión). Antes de ejecutar se muestra el usuario y las IP y debes escribir otra vez el username para confirmar.

Se conserva el home por defecto. La opción **Borrar también su carpeta personal y correo local** activa `remove` de Ansible; solo se permite cuando el home local es exactamente `/home/USERNAME`. Se rechazan root, nobody, el usuario SSH y las cuentas locales con UID fuera de 1000–65533. No se eliminan cuentas de directorio central: se consulta expresamente la base local de usuarios. Si la cuenta no existe, se informa sin modificar nada. No se fuerzan cierres de sesiones; si el usuario está conectado, userdel puede fallar y su mensaje se mostrará por IP. El borrado no tiene deshacer; realiza las copias que necesites antes.

## Logs y errores por IP

Durante la ejecución se actualizan los paneles por IP. Los equipos con errores se marcan en rojo y se despliegan automáticamente al detectar el primer fallo. Puedes filtrar por una IP o mostrar solo equipos con errores, y descargar el resumen JSON con esos detalles. Se muestran `msg`, `stdout`, `stderr`, excepciones y código de salida cuando están disponibles, incluidos resultados de tareas en bucle. Los errores generales de Ansible sin IP asignable se presentan aparte.

Los valores de las credenciales SSH/sudo conocidas y del hash de usuario se sustituyen por `[OCULTO]`. También se respeta `no_log` de Ansible y se recortan salidas muy extensas (16.000 caracteres por campo y hasta 100 resultados por bucle). La ocultación no puede identificar todos los secretos que imprima una receta personalizada: usa `no_log: true` en tareas sensibles. No escribas secretos en nombres de tareas. Los resúmenes descargados pueden contener datos de salida de tus comandos; compártelos solo cuando corresponda.

## Añadir nuevas recetas desde la interfaz

En **Lanzar recetas**, pulsa **Añadir nueva receta**, en la parte superior derecha. Se abre una ventana modal. Indica un nombre, una descripción opcional y escribe el YAML o impórtalo desde un archivo `.yml`/`.yaml` (máximo 64 KiB). Pulsa **Validar y guardar receta**. Si Ansible encuentra un error de sintaxis o un módulo no disponible, se muestra el error y no se guarda.

El formato es una **lista de tareas**, no un playbook completo. Por ejemplo:

```yaml
- name: Instalar Git
  ansible.builtin.apt:
    name: git
    state: present
    update_cache: true
    cache_valid_time: 3600
```

La aplicación proporciona `hosts: aula`, `become: true`, recopilación de hechos y lotes de 10 equipos. Puedes usar bloques y las variables existentes (`aula_user`, `aula_jdk`, `aula_settings`, `aula_extensions`, `aula_folders`); las variables calculadas por las recetas integradas, como `aula_home`, requieren ejecutar antes la receta correspondiente. Las recetas personalizadas se ejecutan después de las integradas, en el orden de la lista. `aula_password_hash` solo tiene contenido al seleccionar también la creación de usuario.

Las recetas nuevas aparecen como **Personalizada**, inicialmente sin seleccionar. Puedes revisar su YAML con **Ver YAML**. Se conservan al reiniciar en `data/recipes/`. No se guardan credenciales automáticamente; no escribas secretos en estos archivos. Para cambiar una receta, añádela con un nombre de versión distinto; esta entrega no incluye edición ni borrado desde la interfaz.

Solo importa código que hayas revisado: las tareas tienen las capacidades normales de Ansible, incluido sudo en los destinos y posibles acciones locales o delegadas si el YAML las solicita. La comprobación de sintaxis no verifica que la receta sea segura, que sus paquetes existan ni que vaya a funcionar en LliureX. Los roles, colecciones y archivos externos no se importan con el YAML; instala sus dependencias o coloca los archivos necesarios en `playbooks/` antes de ejecutarla. Prueba la nueva receta primero en un único PC.

Para actualizar desde la primera entrega, detén la aplicación, sustituye los archivos del proyecto por los de este ZIP y conserva tu directorio `data/`. Reinicia y recarga el navegador. El ZIP no incluye ni sobrescribe inventarios o recetas guardadas en `data/`.

## Datos y credenciales

- El navegador no usa almacenamiento local ni cookies para las credenciales. Los campos se vacían después de iniciar una ejecución.
- Ansible Runner necesita archivos de trabajo temporales: se crean con permisos privados (`0700` directorio y `0600` archivos) y se eliminan al finalizar normalmente, incluso si una tarea falla. Un corte de corriente o terminación forzada puede dejar un directorio `/tmp/aula-*`; revísalo y elimínalo antes de reutilizar un equipo compartido. No se promete borrado físico seguro.
- `data/hosts.yml` y sus copias contienen IP y puerto, sin contraseñas. Las credenciales no se guardan en el proyecto.
- El historial está en memoria y desaparece al reiniciar. Los resúmenes incluyen la salida de diagnóstico disponible, filtrada según las reglas de ocultación anteriores.
- La aplicación solo escucha en loopback y exige un token de sesión para las acciones. Es una herramienta para un administrador local; no incorpora cuentas web, multiusuario ni despliegue remoto.
- Cancelar detiene el trabajo, sin deshacer modificaciones ya aplicadas. Espera al estado final y no cierres la aplicación durante las tareas. Si cancelas una instalación, comprueba después el estado de APT en los equipos afectados.

## Playbooks y diagnóstico local

Cada receta tiene su playbook independiente: `playbooks/check.yml`, `user.yml`, `java.yml`, `vscode.yml`, `folders.yml` y `delete_user.yml`. Cada uno incluye sus comprobaciones y se puede ejecutar directamente. Las tareas compartidas están en `playbooks/tasks/`. `site.yml` queda como coordinador de importaciones; la eliminación solo se activa por su etiqueta explícita. La aplicación genera un coordinador temporal que importa únicamente las recetas seleccionadas, además de las comprobaciones comunes; las recetas personalizadas también reciben un archivo de playbook propio en ese proyecto temporal. Los parámetros comunes usan el prefijo `aula_`. Puedes comprobar sintaxis y ejecutar una prueba manual sin contraseñas en argumentos:

```bash
source .venv/bin/activate
ansible-playbook -i data/hosts.yml playbooks/site.yml --syntax-check
ansible-playbook -i data/hosts.yml playbooks/site.yml -u profesor -k -K --tags check
```

Omite `-k` si usas clave y `-K` si sudo no necesita contraseña. Estas órdenes utilizan la comprobación SSH habitual. Si necesitas diagnóstico adicional al mostrado por IP, reproduce primero la prueba de conexión desde terminal. Revisa el playbook antes de ejecutar otras etiquetas manualmente y evita guardar secretos en variables de texto sin cifrar.

## Verificación del proyecto

```bash
python -m unittest discover -s tests -v
ansible-playbook -i 'localhost,' playbooks/site.yml --syntax-check
```

Las pruebas locales cubren validaciones e inventario; no sustituyen una prueba real en el aula. Esta entrega no ha ejecutado cambios sobre PCs LliureX reales.

Referencias técnicas: [Ansible Runner](https://docs.ansible.com/projects/runner/en/stable/), [usuario de Ansible](https://docs.ansible.com/projects/ansible/latest/collections/ansible/builtin/user_module.html), [VS Code en Linux](https://code.visualstudio.com/docs/setup/linux), [CLI de VS Code](https://code.visualstudio.com/docs/configure/command-line).

## Desarrollo de la interfaz

La versión compilada está incluida en `web/dist/`: **para ejecutar la aplicación solo hace falta Python; Node.js no se instala en los equipos de control ni en los destinos**. Tanto `app.py` como `iniciar.py` sirven la misma interfaz compilada, con su modo y token de sesión correspondientes. Los recursos se sirven localmente, sin CDN.

El código editable está en `frontend/src/`. `App.jsx` compone las vistas; `components/OverviewPanel.jsx`, `EquipmentPanel.jsx`, `RecipeWizard.jsx` y `ExecutionPanel.jsx` contienen los apartados. Los modales y los logs por equipo también tienen componentes propios. `hooks/useAula.jsx` coordina el estado y las acciones a través de `AulaContext`, y `lib/recipes.js` contiene el catálogo de recetas. Los componentes de `frontend/src/components/ui/` se añadieron desde el registro oficial de shadcn/ui y pueden personalizarse en el proyecto. Las traducciones están en `frontend/src/translations.json` y en los textos de cada vista. El servidor Python sigue gestionando inventarios, credenciales, validación y ejecución.

`useAula` mantiene la interfaz pública del contexto y delega sus responsabilidades:

| Hook | Responsabilidad |
| --- | --- |
| `useAulaForm.jsx` | Parámetros, campos, puerto SSH y aplicación de los valores globales. |
| `useInventory.js` | Carga y guardado de hosts, selección, redes y descubrimiento automático o manual. |
| `useRecipes.js` | Catálogo, selección y creación de recetas personalizadas. |
| `useRecipeReview.js` | Validación de parámetros y construcción de la solicitud que se revisa antes de ejecutar. |
| `useExecution.js` | Inicio, consulta periódica de trabajos, agrupación de logs, filtros y descarga del resumen. |
| `useTaskFeedback.js` | Estado de operaciones, mensajes y confirmaciones compartidas. |
| `useGlobalVariables.js` | Carga, edición y persistencia de las variables globales. |

Los valores iniciales y la lectura de listas están en `lib/aulaForm.js`. La navegación y la coordinación de los pasos permanecen en `useAula.jsx`.


Para desarrollar o recompilar, usa una versión de Node.js compatible con la versión de Vite fijada en `frontend/package-lock.json` (Node 22.12 o posterior):

```bash
cd frontend
npm ci
npm run build
```

La compilación actualiza `web/dist/`. Incluye ese directorio en cualquier distribución del proyecto. Después de actualizar el servidor Python, reinícialo y recarga el navegador. Para desarrollo con recarga automática, inicia primero `app.py` y después ejecuta `npm run dev` en `frontend/`; Vite obtiene el token del servidor local y reenvía las peticiones a su API.

Pruebas de la interfaz (usan API simulada, no modifican PCs):

```bash
cd frontend
npx playwright install chromium  # Solo la primera vez, si no tienes un navegador de pruebas
npm test
npm run format:check
```

También puedes reutilizar Chrome: `CHROME_PATH=/ruta/a/chrome npm test`. Las pruebas cubren los bloqueos del menú, el inventario existente, los pasos y parámetros, la confirmación de borrado, los logs, la importación de recetas en la modal, la cancelación, el instalador, los idiomas y la persistencia del tema. Los tests Python también comprueban los recursos compilados, el token por servidor y el rechazo de rutas no permitidas.

## Variables globales

Abre **Variables** en el menú, incluso antes de seleccionar equipos. Edita el YAML y pulsa **Guardar variables**. Se conserva en `data/global_vars.yml`, con una copia del archivo anterior antes de sustituirlo. Las variables admiten textos, números, booleanos, listas y mapas. La aplicación valida el YAML y las variables conocidas antes de guardar.

Puedes configurar `aula_user`, `aula_jdk`, `aula_extensions`, `aula_settings`, `aula_folders`, `aula_reset_password` y `aula_delete_home`, además de variables propias utilizadas por tus recetas. Los parámetros conocidos rellenan el asistente como valores predeterminados; puedes modificarlos para una ejecución concreta. Las credenciales SSH/sudo y el hash de la contraseña del usuario se proporcionan durante la ejecución y no se admiten como variables globales de conexión. Las variables de control de Ansible y los hechos internos calculados por los playbooks están reservados.

Orden de prioridad: valores predeterminados de `playbooks/vars/global.yml`, variables guardadas desde la interfaz y, finalmente, parámetros de la ejecución. Las ejecuciones toman una instantánea: cambiar las variables no altera un trabajo ya iniciado. Las variables propias también se entregan a las recetas personalizadas. No incluyas secretos en variables que tus tareas impriman.

Ejemplo de ejecución directa de un playbook individual con las variables guardadas (omite `-e @data/global_vars.yml` si aún no has guardado variables):

```bash
ansible-playbook -i data/hosts.yml playbooks/java.yml -u profesor -e @data/global_vars.yml
```

La creación de usuario necesita además `aula_password_hash`, que la interfaz calcula de forma temporal a partir de la contraseña. La eliminación directa requiere indicar explícitamente `aula_delete_user`; conserva las comprobaciones del usuario SSH, UID y home. Las credenciales de conexión en la consola se gestionan con el agente SSH o las opciones habituales de Ansible.
