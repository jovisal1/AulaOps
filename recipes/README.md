# Recetas incluidas desde el ZIP adjunto

AulaOps carga estos cuatro archivos JSON junto con las recetas guardadas por el usuario en `data/recipes/`. Cada uno contiene su lista de tareas, descripción y nombre de archivo de origen. No necesitan los archivos `variables_comunes.yml` ausentes del ZIP.

- **Instalación de MongoDB y Compass:** conserva MongoDB 8.0 y Compass 1.46.2 del original. Detecta la base Ubuntu (`focal`, `jammy` o `noble`) y exige x86_64 por el paquete Compass adjunto. Habilita el servicio `mongod`.
- **Instalación de MySQL Workbench y Docker:** instala Workbench mediante Snap, Docker desde su repositorio oficial y MySQL 8.4 en `mysql-db`. El contenedor publica `127.0.0.1:33060`, mantiene datos en el volumen `aula-mysql-data` y se reinicia con Docker. Usuario MySQL: `root`; contraseña inicial de prácticas del original: `secret`. Puede cambiarse antes de la primera creación definiendo `aula_mysql_root_password` en Variables. Un contenedor ya existente se conserva: cambiar esa variable no cambia su contraseña. Las tareas que pueden mostrar la contraseña usan `no_log`.
- **Instalación de XAMPP, PHP y Composer:** requiere una cuenta del aula existente (o crearla antes), arquitectura x86_64, el instalador `xampp-linux-x64-8.2.12-0-installer.run` y `crear_db.sql` en `HOME/Escritorio` de esa cuenta. Puedes indicar otras rutas remotas con `aula_xampp_installer` y `aula_xampp_sql` en Variables, por ejemplo al copiar los archivos a una subcarpeta del escritorio. Se ejecuta el instalador como administrador, verifica las extensiones PDO/MySQL y la firma del instalador de Composer. El SQL se ejecuta **en cada lanzamiento** contra MariaDB de XAMPP con `root` sin contraseña, como en el original; su contenido debe permitir repetir la ejecución si vas a relanzar la receta. El ZIP no trae el instalador ni el SQL.
- **Apagar PCs del aula:** programa el apagado a un minuto y comprueba desde el equipo de control que se cierra el puerto SSH. Debe colocarse al final; la aplicación valida ese orden. Solo se ejecuta si se selecciona y confirma el lanzamiento.

Se han validado la sintaxis de Ansible y la integración con el catálogo. No se han instalado los paquetes ni ejecutado el SQL o el apagado en equipos remotos. La disponibilidad de Snap, los paquetes y las descargas se comprueba al ejecutar en la distribución de destino.

Fuentes de las adaptaciones:
- [MongoDB 8.0 en Ubuntu](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-ubuntu/)
- [Docker Engine en Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [XAMPP en Linux](https://www.apachefriends.org/faq_linux)
