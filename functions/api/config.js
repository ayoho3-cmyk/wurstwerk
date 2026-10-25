// GET /api/config — tells the page whether Square payments are set up.
// Application ID and Location ID are public by design; the access token never leaves the server.
export function onRequestGet({ env }) {
  const enabled = Boolean(env.SQUARE_APPLICATION_ID && env.SQUARE_LOCATION_ID && env.SQUARE_ACCESS_TOKEN);
  return Response.json(
    {
      enabled,
      appId: enabled ? env.SQUARE_APPLICATION_ID : null,
      locationId: enabled ? env.SQUARE_LOCATION_ID : null,
      env: env.SQUARE_ENV === "production" ? "production" : "sandbox",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
