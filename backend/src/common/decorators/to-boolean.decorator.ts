import { Transform } from 'class-transformer';

/**
 * Parses a query-string boolean correctly.
 *
 * `main.ts` enables `transformOptions: { enableImplicitConversion: true }`,
 * which converts query parameters to their declared types. For booleans it does
 * so with what amounts to `Boolean(value)` — and every non-empty string is
 * truthy, so the string `"false"` becomes `true`:
 *
 *   GET /hospitals?availableOnly=false   →   availableOnly === true
 *
 * The filter therefore inverts itself: asking to include unavailable facilities
 * silently returns only available ones. Existing code worked around this with
 * `String(availableOnly) === 'true'` scattered across controllers, which works
 * but leaves the DTO's declared type lying about the value it holds.
 *
 * Applied above `@IsBoolean()`, since class-transformer runs before validation:
 *
 *   @ToBoolean()
 *   @IsBoolean()
 *   @IsOptional()
 *   availableOnly?: boolean;
 *
 * Absent values stay `undefined` so `@IsOptional()` still works, and
 * unrecognised values are passed through unchanged so `@IsBoolean()` reports a
 * proper validation error rather than this decorator silently guessing.
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }
    // Not a recognisable boolean — hand it to @IsBoolean() to reject.
    return value;
  });
}
