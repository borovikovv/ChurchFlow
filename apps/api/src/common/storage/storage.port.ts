export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
}

export interface StoragePort {
  createPresignedUpload(input: {
    organizationId: string;
    filename: string;
    contentType: string;
    byteSize: number;
  }): Promise<PresignedUpload>;
  createSignedReadUrl(input: { objectKey: string; expiresInSeconds: number }): Promise<string>;
}
