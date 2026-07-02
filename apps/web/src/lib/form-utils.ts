import type { CompanyInput, ContactInput, CreateInvoiceInput, OpportunityInput, OpportunityStage, ActivityType } from '@sparqplug/types';

const URL_PREFIX = 'https://';

export interface ContactFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  status: ContactInput['status'];
  companyId: string;
}

export interface CompanyFormValues {
  name: string;
  industry: string;
  website: string;
  size: '' | NonNullable<CompanyInput['size']>;
}

export interface OpportunityFormValues {
  name: string;
  stage: OpportunityInput['stage'];
  value: string;
  probability: string;
  expectedCloseDate: string;
  companyId: string;
  contactId: string;
}

export interface ActivityFormValues {
  type: ActivityType;
  subject: string;
  description: string;
  scheduledAt: string;
  contactId: string;
  companyId: string;
}

export interface BillingCustomerFormValues {
  name: string;
  email: string;
}

export interface BillingInvoiceFormValues {
  customerId: string;
  description: string;
  amount: string;
  currency: string;
  dueDate: string;
  notes: string;
  autoSend: boolean;
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

export function prefillUrlField(value: string) {
  return value.trim() === '' ? URL_PREFIX : value;
}

export function normalizeUrlField(value: string | null | undefined) {
  const trimmed = trimOrUndefined(value);

  if (!trimmed || trimmed === URL_PREFIX || trimmed === 'http://') {
    return undefined;
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${URL_PREFIX}${trimmed.replace(/^\/+/, '')}`;
}

export function formatPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');
  const hasPlusPrefix = trimmed.startsWith('+');

  if (!digits) {
    return hasPlusPrefix ? '+' : '';
  }

  const isUsNumber = digits.length <= 10 || (digits.length === 11 && digits.startsWith('1'));
  if (isUsNumber) {
    const countryCode = digits.length === 11 ? '1' : '';
    const nationalDigits = countryCode ? digits.slice(1) : digits;
    const area = nationalDigits.slice(0, 3);
    const prefix = nationalDigits.slice(3, 6);
    const line = nationalDigits.slice(6, 10);

    let formatted = '';
    if (countryCode) {
      formatted += `+${countryCode} `;
    }
    if (area) {
      formatted += area.length < 3 ? `(${area}` : `(${area})`;
    }
    if (prefix) {
      formatted += area.length === 3 ? ` ${prefix}` : prefix;
    }
    if (line) {
      formatted += `-${line}`;
    }

    return formatted;
  }

  return hasPlusPrefix ? `+${digits}` : digits;
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '');
}

export function sanitizeDecimalInput(value: string) {
  const sanitized = value.replace(/[^\d.]/g, '');
  const [whole, ...fractionParts] = sanitized.split('.');

  if (fractionParts.length === 0) {
    return sanitized;
  }

  return `${whole}.${fractionParts.join('')}`;
}

export function normalizeContactPayload(form: ContactFormValues): ContactInput {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: trimOrUndefined(form.email),
    phone: trimOrUndefined(formatPhoneInput(form.phone)),
    title: trimOrUndefined(form.title),
    companyId: trimOrUndefined(emptyToUndefined(form.companyId)),
    status: form.status ?? 'lead',
    tags: [],
    customFields: {},
  };
}

export function normalizeCompanyPayload(
  form: CompanyFormValues,
  status: CompanyInput['status'] = 'prospect',
): CompanyInput {
  return {
    name: form.name.trim(),
    industry: trimOrUndefined(form.industry),
    website: normalizeUrlField(form.website),
    size: emptyToUndefined(form.size) as CompanyInput['size'],
    status,
    tags: [],
    customFields: {},
  };
}

export function normalizeOpportunityPayload(form: OpportunityFormValues): OpportunityInput {
  const parsedValue = Number.parseFloat(form.value);
  const parsedProbability = Number.parseInt(form.probability, 10);

  return {
    name: form.name.trim(),
    stage: form.stage,
    value: Number.isFinite(parsedValue) ? parsedValue : 0,
    probability: Number.isFinite(parsedProbability) ? parsedProbability : 20,
    expectedCloseDate: trimOrUndefined(form.expectedCloseDate),
    companyId: trimOrUndefined(emptyToUndefined(form.companyId)),
    contactId: trimOrUndefined(emptyToUndefined(form.contactId)),
    currency: 'usd',
    tags: [],
    customFields: {},
  };
}

export function normalizeActivityPayload(form: ActivityFormValues) {
  return {
    type: form.type,
    subject: trimOrUndefined(form.subject) ?? form.type.replace('_', ' '),
    description: trimOrUndefined(form.description),
    scheduledAt: trimOrUndefined(form.scheduledAt),
    contactId: trimOrUndefined(emptyToUndefined(form.contactId)),
    companyId: trimOrUndefined(emptyToUndefined(form.companyId)),
  };
}

export function normalizeBillingCustomerPayload(form: BillingCustomerFormValues) {
  const email = form.email.trim();

  return {
    email,
    name: trimOrUndefined(form.name) ?? email,
  };
}

export function normalizeBillingInvoicePayload(form: BillingInvoiceFormValues): CreateInvoiceInput {
  const parsedAmount = Number.parseFloat(form.amount);

  return {
    customerId: form.customerId,
    lineItems: [
      {
        description: form.description.trim(),
        quantity: 1,
        unitAmount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      },
    ],
    dueDate: trimOrUndefined(form.dueDate),
    currency: trimOrUndefined(form.currency)?.toLowerCase() ?? 'usd',
    notes: trimOrUndefined(form.notes),
    autoSend: form.autoSend,
  };
}