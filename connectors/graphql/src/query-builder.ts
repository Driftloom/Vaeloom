export interface QueryBuilderOptions {
  operationName?: string;
  variables?: Record<string, string>;
}

export function buildQuery(
  fields: string[],
  operationName?: string,
): string {
  const opName = operationName ? ` ${operationName}` : '';
  const fieldsStr = fields.map((f) => formatField(f)).join('\n    ');
  return `${opName} {\n    ${fieldsStr}\n  }`;
}

export function buildMutation(
  fields: string[],
  operationName?: string,
): string {
  const opName = operationName ? ` ${operationName}` : '';
  const fieldsStr = fields.map((f) => formatField(f)).join('\n    ');
  return `mutation${opName} {\n    ${fieldsStr}\n  }`;
}

function formatField(field: string): string {
  if (field.includes('(') || field.includes('{')) {
    return field;
  }
  return field;
}
