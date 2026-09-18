export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<boolean> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  return response.ok;
}
