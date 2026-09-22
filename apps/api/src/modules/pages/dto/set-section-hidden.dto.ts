import {
  setWebsiteSectionHiddenSchema,
  type SetWebsiteSectionHiddenInput,
} from '@churchflow/shared';

export class SetSectionHiddenDto implements SetWebsiteSectionHiddenInput {
  static readonly schema = setWebsiteSectionHiddenSchema;

  hidden!: boolean;
}
