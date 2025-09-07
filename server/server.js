import "dotenv/config";
import app from "./app.js";

const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
