const fallbackUrl = "https://www.google.com";

try {
  const params = new URLSearchParams(window.location.search);
  const configuredUrl = params.get("url");
  window.location.replace(configuredUrl || fallbackUrl);
} catch {
  window.location.replace(fallbackUrl);
}
