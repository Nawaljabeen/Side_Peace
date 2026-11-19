export async function checkServer(baseUrl, fetchFn = fetch) {
  try {
    const response = await fetchFn(`${baseUrl}/health`);
    if (!response.ok) {
      return false;
    }
    const body = await response.json();
    return body.status === "ok";
  } catch (error) {
    console.error("SidePeace: backend health check failed", error);
    return false;
  }
}
