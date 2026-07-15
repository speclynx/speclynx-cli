// apidom-ls's package `exports` map points these AsyncAPI JSON Schema provider
// subpaths at type declarations that are not actually shipped — only the main
// barrel ships types. Declare them here so they can be imported under nodenext
// module resolution. Each module exports a ValidationProvider constructor.
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-20-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi20JsonSchemaValidationProvider: new () => ValidationProvider;
}
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-21-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi21JsonSchemaValidationProvider: new () => ValidationProvider;
}
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-22-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi22JsonSchemaValidationProvider: new () => ValidationProvider;
}
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-23-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi23JsonSchemaValidationProvider: new () => ValidationProvider;
}
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-24-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi24JsonSchemaValidationProvider: new () => ValidationProvider;
}
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-25-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi25JsonSchemaValidationProvider: new () => ValidationProvider;
}
declare module '@speclynx/apidom-ls/services/validation/providers/asyncapi-26-json-schema' {
  import type { ValidationProvider } from '@speclynx/apidom-ls';
  export const Asyncapi26JsonSchemaValidationProvider: new () => ValidationProvider;
}
