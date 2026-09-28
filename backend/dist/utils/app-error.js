export class AppError extends Error {
    statusCode;
    code;
    errors;
    constructor(statusCode, message, code = 'APPLICATION_ERROR', errors) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.errors = errors;
    }
}
