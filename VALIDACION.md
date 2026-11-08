# Verificación de esta entrega

Comprobado en el entorno de desarrollo:

- Compilación de producción con Vite correcta. Interfaz React con 14 componentes oficiales de shadcn/ui, recursos locales y formato de código verificado con Prettier.
- Veintiocho pruebas Python automatizadas: validación de destinos y parámetros, rechazo de rangos públicos o excesivos, inventario y copias de seguridad, hash de contraseña, limpieza del directorio temporal y exclusión de secretos de los eventos.
- Validación real de recetas nuevas con Ansible: persistencia y recarga, rechazo de YAML/playbooks/módulos inválidos, detección de nombres duplicados y selección en el proyecto temporal de ejecución.
- Protección del borrado por username, confirmación exacta y separación de recetas de configuración.
- Logs con mensajes por IP, ocultación de credenciales, respeto de no_log y límite de tamaño.
- Instalador: secuencia de pasos simulada, errores visibles y contraseña sudo excluida de argumentos y registros. No se ha ejecutado APT ni instalado paquetes del sistema en esta verificación.
- `ansible-playbook --syntax-check` correcto, incluida la receta de eliminación.
- Ejecución real de Ansible Runner con una tarea `debug` local, sin modificar el sistema, y recepción de eventos correctas.
- Comprobaciones HTTP del servidor: entrega del HTML, lectura del inventario, rechazo de acciones sin token y validación de redes.

- Quince pruebas Playwright en Chrome, con API simulada: menú condicionado por selección e inicio de trabajos, inventario existente, pasos y parámetros, vuelta atrás, eliminación con confirmación exacta, modal de recetas e importación YAML, fallos de validación e inicio, cancelación, instalador, idiomas, temas y persistencia.
- El transporte Python entrega los recursos compilados en ambos servidores, inyecta su modo y token, aplica CSP con scripts locales y rechaza rutas de recursos no permitidas. Un inventario ausente, vacío o inválido se diferencia expresamente.
- Revisión visual de escritorio y móvil, en claro y oscuro, incluida la modal de recetas en valenciano. Sin desplazamiento horizontal en las vistas móviles comprobadas.

- Detección automática de redes: selección según la ruta preferida, máscara real, exclusión de interfaces no aptas y de las IP locales, detección de cambios de conexión y errores sin conexión o sin iproute2. Las pruebas simulan los datos del sistema y los banners SSH.
- Interfaz separada en vistas y modales; `App.jsx` se mantiene por debajo de 70 líneas. Se conserva el recorrido completo del asistente tras extraer los componentes.

- Playbooks individuales: sintaxis de las seis recetas y del coordinador; cada ejecución importa únicamente las recetas seleccionadas y las comprobaciones comunes.
- Variables globales: valores predeterminados, persistencia, copias, rechazo de YAML/tipos/variables reservadas, instantánea y prioridad de parámetros de ejecución. El asistente recibe los valores guardados.
- Rango manual disponible cuando falla la detección de red o la búsqueda no devuelve equipos.

Pendiente en el entorno del usuario:

- Instalación automática completa en un PC LliureX real y apertura de su navegador.
- Eliminación de una cuenta de prueba y comprobación del home según la opción seleccionada.
- Descubrimiento y autenticación SSH/sudo en la red real.
- Instalación de Java y VS Code, extensiones y copia de carpetas sobre LliureX.
- Compatibilidad con la configuración particular de repositorios y cuentas del centro.

No se ha contactado con PCs del aula ni aplicado cambios en ellos. La primera ejecución debe ser la receta de prueba sobre un único equipo. Después conviene validar cada receta en ese equipo antes de seleccionar el resto del aula.

- Refactor de hooks: `useAula` queda en 95 líneas como coordinador. Se reutiliza el contrato de `AulaContext` y se separan formulario, inventario, catálogo, revisión, ejecución y mensajes en hooks específicos. La compilación y las pruebas de navegador verifican los recorridos existentes.
