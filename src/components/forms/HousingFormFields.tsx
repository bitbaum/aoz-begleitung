'use client'

/**
 * Housing Form Fields
 *
 * Config-driven form rendering using HOUSING_FACTORS and HOUSING_FORM_SECTIONS.
 * Add a new factor to config → it automatically appears in the form.
 */

import { DynamicFormField } from './DynamicFormField'
import type { FormFieldValue } from './DynamicFormField'
import { HOUSING_FORM_SECTIONS, getHousingFactorsBySection } from '@/lib/config/housing-factors'

type Factor = ReturnType<typeof getHousingFactorsBySection>[number]
type Values = Record<string, FormFieldValue>

interface HousingFormFieldsProps {
  defaultValues?: Values
  isEdit?: boolean
}

/** One field per factor, in the order given. */
function Fields({ factors, values }: { factors: Factor[]; values: Values }) {
  return (
    <>
      {factors.map((factor) => (
        <DynamicFormField key={factor.id} factor={factor} value={values[factor.id]} />
      ))}
    </>
  )
}

/** The section's booleans side by side — nothing at all when it has none. */
function BooleanRow({ factors, values }: { factors: Factor[]; values: Values }) {
  const booleans = factors.filter((f) => f.type === 'boolean')
  if (booleans.length === 0) return null
  return (
    <div className="flex flex-wrap gap-6">
      <Fields factors={booleans} values={values} />
    </div>
  )
}

export function HousingFormFields({ defaultValues = {}, isEdit = false }: HousingFormFieldsProps) {
  // Get sections sorted by order
  const sections = [...HOUSING_FORM_SECTIONS].sort((a, b) => a.order - b.order)

  return (
    <>
      {sections.map((section) => {
        const factors = getHousingFactorsBySection(section.id)

        // Skip empty sections
        if (factors.length === 0) return null

        // Determine layout based on section content
        const hasOnlyBooleans = factors.every((f) => f.type === 'boolean')
        const hasScalesOrNumbers = factors.some((f) => f.type === 'scale')
        const isBasicSection = section.id === 'basic'

        return (
          <div key={section.id} className="card">
            <h2 className="text-lg font-semibold text-ui-text mb-4">{section.label}</h2>
            {section.description && (
              <p className="text-sm text-ui-muted mb-4">{section.description}</p>
            )}

            {hasOnlyBooleans ? (
              // Horizontal layout for boolean-only sections
              <BooleanRow factors={factors} values={defaultValues} />
            ) : isBasicSection ? (
              // Grid layout for basic info
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {factors.map((factor) => (
                  <div key={factor.id} className={factor.id === 'address' ? 'md:col-span-2' : ''}>
                    <DynamicFormField
                      factor={factor}
                      value={defaultValues[factor.id]}
                      disabled={isEdit && factor.id === 'code'}
                    />
                  </div>
                ))}
              </div>
            ) : hasScalesOrNumbers ? (
              // Grid layout for numeric fields (capacity, facilities), then
              // booleans in a row, then text fields
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <Fields
                    factors={factors.filter((f) => f.type === 'scale')}
                    values={defaultValues}
                  />
                </div>
                <BooleanRow factors={factors} values={defaultValues} />
                <Fields factors={factors.filter((f) => f.type === 'text')} values={defaultValues} />
              </div>
            ) : (
              // Standard vertical layout, booleans in a row at the end
              <div className="space-y-4">
                <Fields
                  factors={factors.filter((f) => f.type !== 'boolean')}
                  values={defaultValues}
                />
                <BooleanRow factors={factors} values={defaultValues} />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
