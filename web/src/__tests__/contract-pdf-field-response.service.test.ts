import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildContractPdfResponses } from '@/services/contract-pdf-field-response.service'
import type { SignField } from '@/services/document-sign-field.service'

const supabaseStub = {
  storage: {
    from: () => ({
      createSignedUrl: vi.fn(),
    }),
  },
}

const baseField: Omit<SignField, 'id' | 'field_type' | 'default_value' | 'label'> = {
  document_file_id: 'doc-1',
  page_number: 1,
  x: 10,
  y: 10,
  width: 10,
  height: 10,
  required: true,
  sort_order: 1,
  created_at: new Date().toISOString(),
}

describe('contract-pdf-field-response.service', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fills missing sender seal/signature responses from default_value', async () => {
    const responses = await buildContractPdfResponses({
      signFields: [
        {
          ...baseField,
          id: 'seal-1',
          field_type: 'seal',
          label: '발송자 도장',
          default_value: 'data:image/png;base64,AAAA',
        },
      ],
      fieldResponses: {},
      contractId: 'contract-1',
      signedAt: '2026-04-06T00:00:00.000Z',
      supabase: supabaseStub,
    })

    expect(responses).toHaveLength(1)
    expect(responses[0].image_data).toBe('data:image/png;base64,AAAA')
  })

  it('keeps explicit response values and backfills text defaults when needed', async () => {
    const responses = await buildContractPdfResponses({
      signFields: [
        {
          ...baseField,
          id: 'text-1',
          field_type: 'text',
          label: '기사 주소',
          default_value: '서울시 강남구',
        },
        {
          ...baseField,
          id: 'sign-1',
          field_type: 'signature',
          label: '기사 서명',
          default_value: 'data:image/png;base64,DEFAULT',
        },
      ],
      fieldResponses: {
        'sign-1': { imageData: 'data:image/png;base64,EXPLICIT', value: 'signed' },
      },
      contractId: 'contract-1',
      signedAt: '2026-04-06T00:00:00.000Z',
      supabase: supabaseStub,
    })

    expect(responses).toHaveLength(2)
    expect(responses.find((response) => response.field_id === 'text-1')?.value).toBe('서울시 강남구')
    expect(responses.find((response) => response.field_id === 'sign-1')?.image_data).toBe('data:image/png;base64,EXPLICIT')
  })

  it('converts URL-based image references into embeddable data URIs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'image/png',
        },
        arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer,
      })
    )

    const responses = await buildContractPdfResponses({
      signFields: [
        {
          ...baseField,
          id: 'seal-1',
          field_type: 'seal',
          label: '발송자 도장',
          default_value: 'https://example.com/seal.png',
        },
      ],
      fieldResponses: {},
      contractId: 'contract-1',
      signedAt: '2026-04-06T00:00:00.000Z',
      supabase: supabaseStub,
    })

    expect(responses).toHaveLength(1)
    expect(responses[0].image_data).toMatch(/^data:image\/png;base64,/)
  })
})
