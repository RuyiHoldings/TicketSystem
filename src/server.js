import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
  console.log(`Ticket system listening on http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing server or run with PORT=3001 npm start.`);
    process.exitCode = 1;
    return;
  }

  throw error;
});
