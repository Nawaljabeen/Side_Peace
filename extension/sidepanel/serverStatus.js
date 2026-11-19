export async function checkServer(baseUrl, fetchFn = fetch) {
  const response = await fetchFn(`${baseUrl}/health`);
  const body = await response.json();
  return body.status === "ok";
}
