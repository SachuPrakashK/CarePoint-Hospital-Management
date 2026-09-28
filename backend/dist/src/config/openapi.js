export const openApiDocument = {
    openapi: '3.1.0',
    info: { title: 'CarePoint Hospital Management API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths: {
        '/auth/login': { post: { summary: 'Authenticate a user', responses: { 200: { description: 'Authenticated' }, 401: { description: 'Invalid credentials' }, 422: { description: 'Validation failed' } } } },
        '/auth/logout': { post: { summary: 'Revoke the current refresh session', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Logged out' } } } },
        '/auth/me': { get: { summary: 'Get current identity and permissions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Current identity' } } } },
        '/dashboard/summary': { get: { summary: 'Role-filtered dashboard summary', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Summary' } } } },
    },
};
