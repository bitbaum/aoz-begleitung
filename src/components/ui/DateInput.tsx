'use client'

import { DateInput as SharedDateInput, type DateInputProps } from '@bitbaum/whenkit/react'

/** Keep the server render German as well as hydration; portal callers may override it. */
export function DateInput(props: DateInputProps) {
  return <SharedDateInput locale="de-CH" {...props} />
}
