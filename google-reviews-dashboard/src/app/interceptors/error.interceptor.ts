import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Maps HTTP status codes to user-friendly error messages. */
const STATUS_MESSAGES: Record<number, string> = {
  0: 'Unable to reach the server. Please check your connection.',
  400: 'The request was invalid. Please check your input and try again.',
  401: 'Authentication required. Please log in.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'The request timed out. Please try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'An internal server error occurred. Please try again later.',
  502: 'The server is temporarily unavailable. Please try again later.',
  503: 'The service is currently unavailable. Please try again later.',
};

/**
 * Functional HTTP interceptor that centralizes error handling.
 *
 * Transforms raw `HttpErrorResponse` objects into errors with user-friendly
 * messages while logging detailed information to the console for debugging.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error(`[HTTP ${req.method}] ${req.urlWithParams}`, {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
      });

      const serverMessage = error.error?.error || error.error?.message;
      const friendlyMessage =
        serverMessage || STATUS_MESSAGES[error.status] || 'An unexpected error occurred.';

      const enrichedError = new HttpErrorResponse({
        error: { ...error.error, error: friendlyMessage },
        headers: error.headers,
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
      });

      return throwError(() => enrichedError);
    }),
  );
};
