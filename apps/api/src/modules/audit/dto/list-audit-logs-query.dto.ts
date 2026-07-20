import { listAuditLogsQuerySchema } from '@churchflow/shared';
import type { ListAuditLogsQuery } from '@churchflow/shared';

export class ListAuditLogsQueryDto implements ListAuditLogsQuery {
  static readonly schema = listAuditLogsQuerySchema;

  cursor?: string;
  limit!: number;
}
