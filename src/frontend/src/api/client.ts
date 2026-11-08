import { ApiResponse } from '../types';

let csrfToken: string | null = null;

export async function bootstrapSecurity(): Promise<void> {
  try {
    const res = await fetch('/api/v1/auth/bootstrap');
    if (res.ok) {
      const body = await res.json();
      if (body.data?.csrfToken) {
        csrfToken = body.data.csrfToken;
      }
    }
  } catch (err) {
    console.warn('Bootstrap auth check failed (backend may be starting)', err);
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    headers.set('X-Vistara-CSRF', csrfToken);
  }

  if (options.body && !(options.body instanceof FormData) && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch {}
    return {
      success: false,
      error: errorMsg,
      timestampUtc: new Date().toISOString(),
    };
  }

  return response.json();
}

export async function browseFolder(initialPath?: string, title?: string): Promise<string | null> {
  try {
    const res = await apiRequest<{ path: string | null; selected: boolean }>('/api/v1/system/browse-folder', {
      method: 'POST',
      body: JSON.stringify({ initialPath, title }),
    });
    if (res.success && res.data?.selected && res.data.path) {
      return res.data.path;
    }
  } catch (err) {
    console.error('Failed to browse folder', err);
  }
  return null;
}


