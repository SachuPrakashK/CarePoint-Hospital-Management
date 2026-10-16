declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; sessionId: string; permissions: string[]; roles: string[] };
    }
  }
}
export {};
