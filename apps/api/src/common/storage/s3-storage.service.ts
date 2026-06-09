import { Injectable } from '@nestjs/common';
import type { PresignedUpload, StoragePort } from './storage.port';

@Injectable()
export class S3StorageService implements StoragePort {
  async createPresignedUpload(input: {
    organizationId: string;
    filename: string;
    contentType: string;
    byteSize: number;
  }): Promise<PresignedUpload> {
    // TODO: Implement with AWS SDK v3 against S3-compatible endpoints such as R2 or AWS S3.
    const objectKey = `${input.organizationId}/uploads/${crypto.randomUUID()}-${input.filename}`;
    return {
      uploadUrl: '',
      objectKey,
      headers: {
        'content-type': input.contentType,
        'content-length': String(input.byteSize)
      }
    };
  }

  async createSignedReadUrl(_input: { objectKey: string; expiresInSeconds: number }): Promise<string> {
    // TODO: Implement short-lived signed reads; never expose bucket credentials to clients.
    return '';
  }
}
