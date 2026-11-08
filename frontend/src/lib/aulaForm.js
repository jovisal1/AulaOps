export const defaults = {
  cidr: "",
  port: "22",
  manual: "",
  ssh_user: "",
  private_key: "",
  ssh_password: "",
  sudo_password: "",
  target_user: "alumno",
  target_password: "",
  reset_password: false,
  delete_username: "",
  delete_home: false,
  jdk: "21",
  extensions: "vscjava.vscode-java-pack",
  settings:
    '{\n  "editor.fontSize": 14,\n  "editor.formatOnSave": true,\n  "files.autoSave": "afterDelay"\n}',
  folders: "",
};
export const splitLines = (value) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
