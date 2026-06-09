import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export interface ZodDto<T> {
  schema: ZodSchema<T>;
}

function hasZodSchema(value: unknown): value is ZodDto<unknown> {
  return typeof value === 'function' && 'schema' in value;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype;

    if (!hasZodSchema(metatype)) {
      return value;
    }

    const result = metatype.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        issues: result.error.issues
      });
    }

    return result.data;
  }
}
