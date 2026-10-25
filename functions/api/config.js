// GET /api/config — tells the page whether Square payments are set up.
// Application ID and Location ID are public by design; the access token never leaves the server.
export function onRequestGet({ env }) {
  const t = v => String(v || "").trim();
  const enabled = Boolean(t(env.SQUARE_APPLICATION_ID) && t(env.SQUARE_LOCATION_ID) && t(env.SQUARE_ACCESS_TOKEN));
  return Response.json(
    {
      enabled,
      appId: enabled ? t(env.SQUARE_APPLICATION_ID) : null,
      locationId: enabled ? t(env.SQUARE_LOCATION_ID) : null,
      env: env.SQUARE_ENV === "production" ? "production" : "sandbox",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
