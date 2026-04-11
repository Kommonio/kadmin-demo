/**
 * Vercel serverless entry point.
 * Re-exports the Express app from the kadmin-server submodule.
 */
const app = require("../server/server");

module.exports = app;
