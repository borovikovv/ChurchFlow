import type { WebsiteFormResult } from '../form-actions';

export type WebsiteFormAction = (formData: FormData) => Promise<WebsiteFormResult>;

export type SubmitWebsiteForm = (
  action: WebsiteFormAction,
  formData: FormData,
  pendingKey: string,
) => Promise<boolean>;

export function formDataOf(values: Record<string, string | number | boolean>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, String(value));
  }

  return formData;
}
