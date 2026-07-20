export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface HomeOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  logoAssetId: string | null;
  logoUrl: string | null;
}

export interface OrganizationHomeApiResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  website: { logoAssetId: string | null } | null;
}
