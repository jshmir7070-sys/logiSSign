export function extractStoragePath(
  reference: string | null | undefined,
  bucket: string
): string | null {
  if (!reference) return null

  const trimmed = reference.trim()
  if (!trimmed) return null

  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith(`${bucket}/`)) {
      return trimmed.slice(bucket.length + 1)
    }
    return trimmed.replace(/^\/+/, '')
  }

  try {
    const url = new URL(trimmed)
    const pathname = decodeURIComponent(url.pathname)
    const patterns = [
      new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`),
      new RegExp(`/storage/v1/object/sign/${bucket}/(.+)$`),
      new RegExp(`/storage/v1/object/authenticated/${bucket}/(.+)$`),
      new RegExp(`/storage/v1/object/${bucket}/(.+)$`),
    ]

    for (const pattern of patterns) {
      const match = pathname.match(pattern)
      if (match?.[1]) return match[1]
    }
  } catch {
    return null
  }

  return null
}

export async function createSignedStorageUrl(
  supabase: {
    storage: {
      from: (bucket: string) => {
        createSignedUrl: (
          path: string,
          expiresIn: number
        ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
      }
    }
  },
  bucket: string,
  reference: string | null | undefined,
  expiresIn = 3600
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const path = extractStoragePath(reference, bucket)
  if (!path) {
    return { path: null, url: null, error: 'storage path not found' }
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) {
    return { path, url: null, error: error.message }
  }

  return { path, url: data?.signedUrl ?? null, error: null }
}
