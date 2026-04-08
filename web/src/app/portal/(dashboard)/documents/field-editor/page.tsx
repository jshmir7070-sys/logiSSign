import { redirect } from 'next/navigation'

type FieldEditorRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function FieldEditorRedirectPage({ searchParams }: FieldEditorRedirectPageProps) {
  const params = (await searchParams) ?? {}
  const nextParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) nextParams.append(key, entry)
      }
      continue
    }

    if (value) nextParams.set(key, value)
  }

  redirect(`/portal/contracts/field-editor${nextParams.toString() ? `?${nextParams.toString()}` : ''}`)
}
