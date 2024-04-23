const path = import.meta.dir;

const server = Bun.serve({
  port: 8080,
  fetch(req): Response {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(`${path}/index.html`));
    }

    if (url.pathname === "/dist/app.js") {
      return new Response(Bun.file(`${path}/dist/app.js`));
    }

    return new Response("Hello!");
  },
});

console.log("Server running at http://localhost:8080");
