// `standalone` output produces a self-contained .next/standalone/server.js
// with only the needed node_modules, for a small production Docker image.
export default { reactStrictMode: true, output: "standalone" };
