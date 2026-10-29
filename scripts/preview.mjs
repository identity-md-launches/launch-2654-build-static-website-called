import { createStaticServer } from './server.mjs';
const port = Number(process.argv[2] || 4173);
const server = createStaticServer(new URL('../dist/', import.meta.url).pathname);
server.listen(port, '0.0.0.0', () => console.log(`Nuntio preview: http://localhost:${port}`));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
