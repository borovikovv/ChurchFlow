import type { WebsiteFormResult } from '../form-actions';

export type WebsiteFormAction = (formData: FormData) => Promise<WebsiteFormResult>;

// Submits a server action, folds its mutation into the editor and reports success so callers
// can close dialogs; `pendingKey` names the control that is busy while it runs.
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
