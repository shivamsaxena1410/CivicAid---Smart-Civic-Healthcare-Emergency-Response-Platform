import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: any;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((res) => {
        // If the service already returned a formatted structure with meta
        if (res && typeof res === 'object' && 'data' in res && ('meta' in res || 'message' in res)) {
          return {
            success: true,
            data: res.data,
            message: res.message || 'Operation successful',
            meta: res.meta,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          data: res,
          message: 'Operation successful',
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
