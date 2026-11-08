const token = document.querySelector('meta[name="aula-token"]')?.content || "";
export async function request(path, body, signal) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Aula-Token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Error de conexión");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const api = (path, body, signal) =>
  request("/api/" + path, body, signal);
