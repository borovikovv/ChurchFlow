'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  WEBSITE_ANALYTICS_ERROR_CODES,
  type WebsiteAnalyticsIntegrationStatus,
} from '@churchflow/shared';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import {
  listWebsiteAnalyticsDataStreamsAction,
  listWebsiteAnalyticsPropertiesAction,
  selectWebsiteAnalyticsPropertyAction,
} from '../actions';
import { AnalyticsActionError } from '../analytics-action-error';
import { flattenAnalyticsProperties } from '../analytics-report-view';

const PROPERTIES_QUERY_KEY = 'website-analytics-properties';
const DATA_STREAMS_QUERY_KEY = 'website-analytics-data-streams';

export function AnalyticsPropertyDialog({
  organizationId,
  selectedPropertyId,
  selectedStreamId,
  triggerLabel,
  onReauthRequired,
  onStatusChange,
}: {
  organizationId: string;
  selectedPropertyId: string | null;
  selectedStreamId: string | null;
  triggerLabel: string;
  onReauthRequired: () => void;
  onStatusChange: (status: WebsiteAnalyticsIntegrationStatus) => void;
}) {
  const t = useTranslations('website');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(selectedPropertyId ?? '');
  const [streamId, setStreamId] = useState(selectedStreamId ?? '');
  const [saving, setSaving] = useState(false);

  // Google may revoke access while the dialog is open; the card has to offer a reconnect then.
  const failure = (result: { error: string; code: string }) => {
    if (result.code === WEBSITE_ANALYTICS_ERROR_CODES.reauthRequired) {
      dialogRef.current?.close();
      onReauthRequired();
    }
    return new AnalyticsActionError(result.error, result.code);
  };

  const properties = useQuery({
    queryKey: [PROPERTIES_QUERY_KEY, organizationId],
    queryFn: async () => {
      const result = await listWebsiteAnalyticsPropertiesAction({ organizationId });
      if (!result.ok) throw failure(result);
      return flattenAnalyticsProperties(result.data);
    },
    enabled: open,
    retry: false,
  });
  const dataStreams = useQuery({
    queryKey: [DATA_STREAMS_QUERY_KEY, organizationId, propertyId],
    queryFn: async () => {
      const result = await listWebsiteAnalyticsDataStreamsAction({ organizationId, propertyId });
      if (!result.ok) throw failure(result);
      return result.data.dataStreams;
    },
    enabled: open && propertyId !== '',
    retry: false,
  });

  const save = async () => {
    setSaving(true);
    try {
      const result = await selectWebsiteAnalyticsPropertyAction({
        organizationId,
        propertyId,
        streamId,
      });
      if (!result.ok) {
        toast.error(failure(result).message);
        return;
      }

      onStatusChange(result.data);
      toast.success(t('analytics.propertySaved'));
      dialogRef.current?.close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      size="md"
      title={t('analytics.choosePropertyTitle')}
      triggerLabel={triggerLabel}
      triggerVariant={selectedPropertyId ? 'secondary' : 'primary'}
      onOpen={() => {
        setPropertyId(selectedPropertyId ?? '');
        setStreamId(selectedStreamId ?? '');
        setOpen(true);
      }}
      onClose={() => setOpen(false)}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={saving || !propertyId || !streamId}>
            {saving ? t('saving') : t('analytics.save')}
          </Button>
        </div>
      }
    >
      <form
        className="stack"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="m-0 text-sm text-[var(--muted)]">
          {t('analytics.choosePropertyDescription')}
        </p>
        {properties.isPending && open ? (
          <p className="m-0 text-sm text-[var(--muted)]">{t('analytics.loadingProperties')}</p>
        ) : null}
        {properties.error ? <p className="form-error">{properties.error.message}</p> : null}
        {properties.data?.length === 0 ? (
          <p className="m-0 text-sm">{t('analytics.noProperties')}</p>
        ) : null}
        {properties.data && properties.data.length > 0 ? (
          <FormSelect
            label={t('analytics.property')}
            required
            value={propertyId}
            onChange={(event) => {
              setPropertyId(event.target.value);
              setStreamId('');
            }}
          >
            <option value="">{t('analytics.chooseProperty')}</option>
            {properties.data.map((property) => (
              <option key={property.id} value={property.id}>
                {property.label}
              </option>
            ))}
          </FormSelect>
        ) : null}
        {propertyId && dataStreams.isPending ? (
          <p className="m-0 text-sm text-[var(--muted)]">{t('analytics.loadingDataStreams')}</p>
        ) : null}
        {dataStreams.error ? <p className="form-error">{dataStreams.error.message}</p> : null}
        {dataStreams.data?.length === 0 ? (
          <p className="m-0 text-sm">{t('analytics.noDataStreams')}</p>
        ) : null}
        {dataStreams.data && dataStreams.data.length > 0 ? (
          <FormSelect
            label={t('analytics.dataStream')}
            required
            value={streamId}
            onChange={(event) => setStreamId(event.target.value)}
          >
            <option value="">{t('analytics.dataStream')}</option>
            {dataStreams.data.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {`${stream.displayName || stream.defaultUri || stream.id} (${stream.measurementId})`}
              </option>
            ))}
          </FormSelect>
        ) : null}
      </form>
    </FormDialog>
  );
}
