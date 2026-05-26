/**
 * Download the latest version of the IDaaS Authentication API OpenAPI specification.
 */
(async () => {
  console.log("Downloading latest IDaaS Authentication OpenAPI file...");

  const response = await fetch("https://docs.trustedauth.com/openapi/authentication.json");

  if (!response.ok) {
    throw new Error(`Failed to download OpenAPI spec: ${response.status} ${response.statusText}`);
  }

  await Bun.write("authentication.json", response);

  console.log("Done.");
})();
