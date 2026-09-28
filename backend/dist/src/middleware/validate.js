import { AppError } from '../utils/app-error.js';
export const validate = (schema) => (req, _res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
        const errors = {};
        for (const issue of result.error.issues) {
            const field = issue.path.slice(1).join('.') || 'request';
            (errors[field] ??= []).push(issue.message);
        }
        return next(new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', errors));
    }
    Object.assign(req, result.data);
    next();
};
