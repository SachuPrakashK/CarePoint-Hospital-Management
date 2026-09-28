export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'APPLICATION_ERROR',
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

