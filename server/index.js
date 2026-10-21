import { createApp } from "./app.js";
const { app, close } = createApp();
const server = app.listen(Number(process.env.PORT ?? 8016), () =>
  console.log(`TravelMemo listening on ${server.address().port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      close();
      process.exit(0);
    }),
  );
