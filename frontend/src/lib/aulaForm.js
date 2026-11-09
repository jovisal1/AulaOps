export const defaults = {
  cidr: "",
  port: "22",
  manual: "",
  ssh_user: "usuario",
  private_key: "",
  ssh_password: "",
  sudo_password: "",
  target_user: "alumno",
  target_password: "",
  reset_password: false,
  user_sudo: true,
  delete_username: "",
  delete_home: false,
  jdk: "21",
  extensions:
    "vscjava.vscode-java-pack\nredhat.java\nsohibe.java-generate-setters-getters\nesbenp.prettier-vscode",
  settings: JSON.stringify(
    {
      "editor.guides.bracketPairs": true,
      "java.server.launchMode": "Standard",
      "[java]": {
        "editor.defaultFormatter": "redhat.java",
        "editor.formatOnSave": true,
      },
      "[html]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "vscode.html-language-features",
      },
      "[css]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "vscode.css-language-features",
      },
      "[javascript]": {
        "editor.maxTokenizationLineLength": 2500,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true,
      },
    },
    null,
    2,
  ),
  folders: "",
  files: [],
  destination_folder: "",
};
export const splitLines = (value) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
