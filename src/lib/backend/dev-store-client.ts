import { type BackendClient } from "@/lib/backend/backend-client";

export const devStoreSource = "dev-store" as const;

export const devStoreBackendClient: BackendClient = {
  source: devStoreSource,
  async handle() {
    return null;
  },
};
