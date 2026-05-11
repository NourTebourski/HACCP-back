import { FieldDefinition } from '../../templates/template.entity';
import { SubmissionValue, Violation } from '../submission.entity';
import { SubmissionStatus } from '../submission.entity';

export function validateSubmissionValues(
  fields: FieldDefinition[],
  values: SubmissionValue[],
): { status: SubmissionStatus; violations: Violation[] } {
  const violations: Violation[] = [];
  const valueMap = new Map(values.map((v) => [v.key, v.value]));

  for (const field of fields) {
    const value = valueMap.get(field.key);

    if (field.required && (value === undefined || value === null || value === '')) {
      violations.push({
        key: field.key,
        label: field.label,
        value: value as string,
        type: 'missing',
        message: `Pflichtfeld "${field.label}" wurde nicht ausgefüllt`,
      });
      continue;
    }

    if (value === undefined || value === null || value === '') continue;

    if (field.type === 'number') {
      const num = Number(value);

      if (field.criticalMin !== undefined && num < field.criticalMin) {
        violations.push({
          key: field.key,
          label: field.label,
          value: num,
          type: 'critical',
          message: `"${field.label}": Wert ${num}${field.unit || ''} unterschreitet kritischen Grenzwert von ${field.criticalMin}${field.unit || ''}`,
        });
      } else if (field.criticalMax !== undefined && num > field.criticalMax) {
        violations.push({
          key: field.key,
          label: field.label,
          value: num,
          type: 'critical',
          message: `"${field.label}": Wert ${num}${field.unit || ''} überschreitet kritischen Grenzwert von ${field.criticalMax}${field.unit || ''}`,
        });
      } else if (field.min !== undefined && num < field.min) {
        violations.push({
          key: field.key,
          label: field.label,
          value: num,
          type: 'warning',
          message: `"${field.label}": Wert ${num}${field.unit || ''} liegt unter dem Sollbereich (min. ${field.min}${field.unit || ''})`,
        });
      } else if (field.max !== undefined && num > field.max) {
        violations.push({
          key: field.key,
          label: field.label,
          value: num,
          type: 'warning',
          message: `"${field.label}": Wert ${num}${field.unit || ''} liegt über dem Sollbereich (max. ${field.max}${field.unit || ''})`,
        });
      }
    }
  }

  let status: SubmissionStatus;
  if (violations.some((v) => v.type === 'critical' || v.type === 'missing')) {
    status = SubmissionStatus.CRITICAL;
  } else if (violations.some((v) => v.type === 'warning')) {
    status = SubmissionStatus.WARNING;
  } else {
    status = SubmissionStatus.OK;
  }

  return { status, violations };
}
