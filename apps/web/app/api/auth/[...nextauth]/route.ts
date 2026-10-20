if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { handlers } from "@/auth";

export const { GET, POST } = handlers;

