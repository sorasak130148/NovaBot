export async function register() {
  // Server mode only: run routines on the server so they fire even when no browser is open
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NOVABOT_DATA_DIR) {
    const { startScheduler } = await import("./lib/server/scheduler");
    startScheduler();
  }
}
