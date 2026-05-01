import { useState } from 'react'

interface StatusLookupFormProps {
  initialReference?: string
  onLookup: (reference: string) => void
}

export function StatusLookupForm({
  initialReference = '',
  onLookup,
}: StatusLookupFormProps) {
  const [reference, setReference] = useState(initialReference)

  return (
    <form
      className="lookup-form"
      onSubmit={(event) => {
        event.preventDefault()
        onLookup(reference)
      }}
    >
      <label className="field">
        <span className="field__label">Report reference</span>
        <input
          className="field__input"
          value={reference}
          onChange={(event) => setReference(event.target.value.toUpperCase())}
          placeholder="KL-ABCD-1234"
        />
      </label>
      <button type="submit" className="button">
        Check status
      </button>
    </form>
  )
}
