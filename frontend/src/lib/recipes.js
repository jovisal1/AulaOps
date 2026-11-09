import {
  ShieldCheck,
  Users,
  FileCode2,
  Terminal,
  Folder,
  Trash2,
} from "lucide-react";
export const builtins = [
  [
    "check",
    "Probar conexión y sudo",
    "Comprueba el acceso sin instalar ni copiar nada.",
    ShieldCheck,
  ],
  [
    "user",
    "Crear usuario del aula",
    "Cuenta local y carpeta personal, con permisos sudo opcionales.",
    Users,
  ],
  [
    "java",
    "Instalar Java JDK",
    "Instala el paquete OpenJDK de la versión indicada.",
    FileCode2,
  ],
  [
    "vscode",
    "Instalación y configuración de VS Code",
    "Editor, extensiones y settings.json del usuario del aula.",
    Terminal,
  ],
  [
    "folders",
    "Copiar carpetas al escritorio",
    "Selecciona archivos y elige su carpeta de destino en el escritorio.",
    Folder,
  ],
  [
    "delete_user",
    "Eliminar usuario por username",
    "Elimina una cuenta local. Su carpeta personal se conserva salvo que marques borrarla.",
    Trash2,
  ],
];
