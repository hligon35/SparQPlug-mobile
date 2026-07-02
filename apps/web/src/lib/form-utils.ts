import type { ContactInput } from '@sparqplug/types';

export interface ContactFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  status: ContactInput['status'];
  companyId: string;
}

export function emptyToUndefined(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }

  return value === '' ? undefined : value;
}

export function trimOrUndefined(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function normalizeContactPayload(form: ContactFormValues): ContactInput {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: trimOrUndefined(form.email),
    phone: trimOrUndefined(form.phone),
    title: trimOrUndefined(form.title),
    companyId: trimOrUndefined(emptyToUndefined(form.companyId)),
    status: form.status ?? 'lead',
    tags: [],
    customFields: {},
  };
}