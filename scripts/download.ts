/**
 * Download the latest version of the IDaaS Authentication API OpenAPI specification.
 */
(async () => {
  console.log("Downloading latest IDaaS Authentication OpenAPI file...");

  const response = await fetch("https://entrust.us.trustedauth.com/help/developer/openapi/authentication.json");

  await Bun.write("authentication.json", response);

  console.log("Done.");
})();
