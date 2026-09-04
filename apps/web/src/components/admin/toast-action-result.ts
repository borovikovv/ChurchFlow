import { toast } from 'react-toastify';

export interface AdminActionResult {
  message: string | null;
  error: string | null;
}

export function toastActionResult(result: AdminActionResult): void {
  if (result.message) toast.success(result.message);
  if (result.error) toast.error(result.error);
}
