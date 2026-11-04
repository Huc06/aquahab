// Outbound HTTP settings for the whole process (Node's fetch, which the Walrus Memory SDK also uses).
// undici's default connect timeout is 10 s; on a slow resolver or a cold TLS handshake the relayer can take
// longer to connect than that, and every write would then fail with UND_ERR_CONNECT_TIMEOUT.
// Import this module first in every entry point.
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new Agent({ connect: { timeout: 30_000 }, keepAliveTimeout: 30_000 }));
