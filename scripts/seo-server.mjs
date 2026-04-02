const PORT = parseInt(Deno.env.get("PORT") || "3002");
const OUTPUT_DIR = Deno.env.get("OUTPUT_DIR") || "./repos";

async function handleScan(req) {
  const formData = await req.formData();
  const file = formData.get("repo");
  const pages = formData.get("pages") || "all";

  if (!file) {
    return new Response(JSON.stringify({ error: "No repo zip received" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `repo-${timestamp}.zip`;
  const filepath = `${OUTPUT_DIR}/${filename}`;
  const data = new Uint8Array(await file.arrayBuffer());
  await Deno.writeFile(filepath, data);

  console.log(`Saved ${filepath} (${(data.length / 1024).toFixed(1)}KB)`);

  return new Response(JSON.stringify({ saved: filename, pages }), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname === "/scan") {
    try {
      return await handleScan(req);
    } catch (err) {
      console.error("Error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not found", { status: 404 });
});
