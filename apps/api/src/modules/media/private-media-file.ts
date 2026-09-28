import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { MediaContent } from './media.service';
import { PRIVATE_MEDIA_HEADERS } from './private-media-url';

/** Headers are set only once the photo is found, so a 404 is never cached as immutable. */
export function privateMediaFile(media: MediaContent, response: Response): StreamableFile {
  for (const [header, value] of Object.entries(PRIVATE_MEDIA_HEADERS)) {
    response.setHeader(header, value);
  }
  return new StreamableFile(media.body, { type: media.mimeType, length: media.body.byteLength });
}
