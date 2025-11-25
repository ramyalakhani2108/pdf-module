import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function generateSlug(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function validateApiKey(request: Request): boolean {
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.API_KEY;

    if (!expectedKey) {
        console.warn('API_KEY not configured in environment');
        return false;
    }

    return apiKey === expectedKey;
}

export function createErrorResponse(message: string, status = 400) {
    return Response.json({ error: message }, { status });
}

export function createSuccessResponse<T>(data: T, status = 200) {
    return Response.json(data, { status });
}
