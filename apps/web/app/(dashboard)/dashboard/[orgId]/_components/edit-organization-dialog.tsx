'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateOrganizationSchema } from '@churchflow/shared';
import type { UpdateOrganizationInput } from '@churchflow/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FormInput } from '@/components/forms/form-input';
import { FormTextarea } from '@/components/forms/form-textarea';
import { validateMemberPhoto } from '@/components/members/member-photo-upload';
import { Button } from '@/components/ui/button';
import {
  confirmOrganizationLogoAction,
  prepareOrganizationLogoAction,
  updateOrganizationAction,
} from '../actions';
import type { HomeOrganization } from '../types';
import { OrganizationLogoField } from './organization-logo';

export function EditOrganizationDialog({
  organization,
  onUpdated,
}: {
  organization: HomeOrganization;
  onUpdated: (organization: HomeOrganization) => void;
}) {
  const t = useTranslations('home');
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savedLogoUrl, setSavedLogoUrl] = useState(organization.logoUrl);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
    },
  });

  const submit = handleSubmit(async (values) => {
    const currentLogoError = validateMemberPhoto(logo);
    setLogoError(currentLogoError);
    if (currentLogoError) return;

    let nextLogoUrl = savedLogoUrl;
    let nextLogoAssetId = organization.logoAssetId;
    if (logo) {
      setUploading(true);
      try {
        const uploadedLogo = await uploadLogo(organization.id, logo, {
          logoUploadFailed: t('logoUploadFailed'),
          unableToConfirmLogo: t('unableToConfirmLogo'),
          unableToPrepareLogoUpload: t('unableToPrepareLogoUpload'),
        });
        nextLogoUrl = uploadedLogo.logoUrl ?? nextLogoUrl;
        nextLogoAssetId = uploadedLogo.assetId ?? nextLogoAssetId;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('logoUploadFailed'));
        return;
      } finally {
        setUploading(false);
      }
    }

    const result = await updateOrganizationAction({
      organizationId: organization.id,
      organization: values,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const nextOrganization = {
      id: result.organization.id,
      name: result.organization.name,
      slug: result.organization.slug,
      status: result.organization.status,
      description: result.organization.description,
      logoAssetId: nextLogoAssetId,
      logoUrl: nextLogoUrl,
    };
    setSavedLogoUrl(nextLogoUrl);
    setLogo(null);
    onUpdated(nextOrganization);
    toast.success(t('organizationUpdated'));
    dialogRef.current?.close();
  });

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => dialogRef.current?.showModal()}>
        {t('edit')}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 h-fit max-h-[min(720px,80dvh)] w-[min(560px,calc(100%-32px))] max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)]"
        ref={dialogRef}
      >
        <form
          onSubmit={submit}
          className="grid max-h-[min(720px,80dvh)] grid-rows-[auto_minmax(0,1fr)_auto]"
          noValidate
        >
          <header className="flex items-start justify-between gap-4 border-b border-[var(--line-muted)] p-6 [&_h2]:m-0 [&_p]:m-0">
            <div>
              <p>{t('editOrganization')}</p>
              <h2 id={titleId}>{organization.name}</h2>
            </div>
            <button
              aria-label={t('closeEditOrganizationPanel')}
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-6">
            <OrganizationLogoField
              currentUrl={savedLogoUrl}
              organizationName={organization.name}
              file={logo}
              error={logoError}
              onChange={(nextLogo, nextError) => {
                setLogo(nextLogo);
                setLogoError(nextError);
              }}
            />
            <FormInput label={t('name')} error={errors.name?.message} {...register('name')} />
            <FormInput label={t('slug')} error={errors.slug?.message} {...register('slug')} />
            <FormTextarea
              label={t('organizationDescription')}
              rows={5}
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
          <footer className="flex justify-end gap-2 border-t border-[var(--line-muted)] bg-[var(--surface)] px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {t('cancel')}
            </Button>
            <Button disabled={isSubmitting || uploading} type="submit">
              {uploading ? t('uploading') : isSubmitting ? t('saving') : t('saveChanges')}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

async function uploadLogo(
  organizationId: string,
  logo: File,
  messages: {
    logoUploadFailed: string;
    unableToConfirmLogo: string;
    unableToPrepareLogoUpload: string;
  },
): Promise<{ assetId?: string; logoUrl?: string }> {
  const prepared = await prepareOrganizationLogoAction({
    organizationId,
    filename: logo.name,
    mimeType: logo.type,
    byteSize: logo.size,
  });
  if (!prepared.ok || !prepared.assetId || !prepared.uploadUrl) {
    throw new Error(prepared.error ?? messages.unableToPrepareLogoUpload);
  }

  const upload = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': logo.type },
    body: logo,
  });
  if (!upload.ok) throw new Error(messages.logoUploadFailed);

  const confirmed = await confirmOrganizationLogoAction({
    organizationId,
    assetId: prepared.assetId,
  });
  if (!confirmed.ok) throw new Error(confirmed.error ?? messages.unableToConfirmLogo);

  return confirmed;
}
