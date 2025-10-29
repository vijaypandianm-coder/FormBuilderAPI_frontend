// src/services/api.js

// Mongo-backed forms API (form definitions, configs, layouts)
export const apiMongo = `${import.meta.env.VITE_API_BASE_URL_MONGO}/api/forms`;

// SQL-backed responses API (submitted answers)
export const apiSql = `${import.meta.env.VITE_API_BASE_URL_SQL}/api/responses`;