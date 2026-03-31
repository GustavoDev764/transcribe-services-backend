import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly data?: unknown,
  ) {
    super(message);
  }
}

export type HttpRequestOptions = {
  headers?: Record<string, string>;
  data?: unknown;
  responseType?: AxiosRequestConfig['responseType'];
};

export class HttpClient {
  static async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<{ status: number; data: T }> {
    try {
      const response: AxiosResponse<T> = await axios.request<T>({
        method,
        url,
        headers: options.headers,
        data: options.data,
        responseType: options.responseType,
      });
      return { status: response.status, data: response.data };
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status;
      const data = error.response?.data;
      const msg = error.message || 'Falha em requisição HTTP';
      throw new HttpClientError(msg, status, data);
    }
  }

  static get<T>(url: string, options: HttpRequestOptions = {}) {
    return this.request<T>('GET', url, options);
  }

  static post<T>(url: string, options: HttpRequestOptions = {}) {
    return this.request<T>('POST', url, options);
  }
}

