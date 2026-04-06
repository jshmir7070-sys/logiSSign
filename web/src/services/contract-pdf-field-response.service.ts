import { createSignedStorageUrl } from '@/lib/storage-reference'
import type { SignField, SignResponse } from './document-sign-field.service'

type RawFieldResponse = {
  value?: string
  imageData?: string
}

type ResponseMap = Record<string, RawFieldResponse>

type SignedUrlCapableStorage = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
    }
  }
}

const IMAGE_FIELD_TYPES = new Set<SignField['field_type']>(['signature', 'seal'])
const STORAGE_BUCKETS = ['seals', 'contracts', 'documents'] as const

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isDataUri(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value)
}

function isRawBase64(value: string): boolean {
  if (!value || value.length < 32 || /\s/.test(value)) return false
  return /^[A-Za-z0-9+/=]+$/.test(value)
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = Buffer.from(await response.arrayBuffer())
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

async function resolveImageData(
  supabase: SignedUrlCapableStorage,
  imageReference: string
): Promise<string | null> {
  const trimmed = imageReference.trim()
  if (!trimmed) return null

  if (isDataUri(trimmed) || isRawBase64(trimmed)) {
    return trimmed
  }

  if (isHttpUrl(trimmed)) {
    return fetchImageAsDataUri(trimmed)
  }

  for (const bucket of STORAGE_BUCKETS) {
    const { url } = await createSignedStorageUrl(supabase, bucket, trimmed, 60 * 30)
    if (url) {
      const dataUri = await fetchImageAsDataUri(url)
      if (dataUri) return dataUri
    }
  }

  return null
}

export async function buildContractPdfResponses(params: {
  signFields: SignField[]
  fieldResponses: ResponseMap
  contractId: string
  signedAt: string
  supabase: SignedUrlCapableStorage
}): Promise<SignResponse[]> {
  const { signFields, fieldResponses, contractId, signedAt, supabase } = params
  const responses: SignResponse[] = []

  for (const field of signFields) {
    const rawResponse = fieldResponses[field.id] ?? {}
    let value = rawResponse.value ?? null
    let imageData = rawResponse.imageData ?? null

    if (IMAGE_FIELD_TYPES.has(field.field_type)) {
      if (!imageData && field.default_value) {
        imageData = field.default_value
      }

      if (imageData) {
        imageData = await resolveImageData(supabase, imageData)
      }
    } else if (!value && field.default_value) {
      value = field.default_value
    }

    if (!value && !imageData) continue

    responses.push({
      id: field.id,
      delivery_id: contractId,
      field_id: field.id,
      driver_id: '',
      value,
      image_data: imageData,
      signed_at: signedAt,
    })
  }

  return responses
}
