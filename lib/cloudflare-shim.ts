// Cloudflare Workers shim for Node.js / Next.js / Vercel environments
export const env = typeof process !== "undefined" ? process.env : {};

export class WorkerEntrypoint {}
export class DurableObject {}
export class WorkflowEntrypoint {}

export default {
  env,
  WorkerEntrypoint,
  DurableObject,
  WorkflowEntrypoint,
};
