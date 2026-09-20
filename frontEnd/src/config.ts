export const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const API_ENDPOINTS = {
    CAMPAIGN: {
        CREATE: '/api/v1/campaign/create',
        LIST: '/api/v1/campaign/getAll',
        SESSIONS: '/api/v1/streaming/sessions',
        DELETE: '/api/v1/campaign/delete',
        REPLAY: '/api/v1/replay/retrieve',
        REPLAY_DEMO: '/api/v1/replay/retrieve/demo',
    },
    AUTH: {
        GOOGLE_CALLBACK: '/api/v1/auth/google/callback',
        VALIDATE_TOKEN: '/api/v1/auth/validateToken',
        REFRESH_TOKEN: '/api/v1/auth/refresh',
        LOGOUT: '/api/v1/auth/logout',
        ME: '/api/v1/auth/me',
    },
    STATIC: {
        MAGIC_FORMAT: '/static/magicFormat.js',
    }
};
