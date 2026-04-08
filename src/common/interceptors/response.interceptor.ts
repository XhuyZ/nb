import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import {
  RESPONSE_MESSAGE_KEY,
} from '../decorators/response-message.decorator';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, { success: boolean; message: string; data: T }>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ success: boolean; message: string; data: T }> {
    const customMessage =
      this.reflector.get<string>(
        RESPONSE_MESSAGE_KEY,
        context.getHandler(),
      ) ??
      this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getClass()) ??
      'Success';

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: customMessage,
        data,
      })),
    );
  }
}
