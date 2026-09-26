import { DOSSIER_TABS, defaultDossierTab, resolveDossierTab } from '../dossier'

const ALL = [...DOSSIER_TABS]

describe('dossier sections', () => {
  it('opens each role on its own work', () => {
    expect(defaultDossierTab('JOBCOACH')).toBe('integration')
    expect(defaultDossierTab('FREIWILLIGENARBEIT')).toBe('integration')
    expect(defaultDossierTab('LIEGENSCHAFTEN')).toBe('housing')
    expect(defaultDossierTab('BETREUUNG')).toBe('overview')
    expect(defaultDossierTab('SOZIALARBEIT')).toBe('overview')
  })

  it('an explicit, visible tab wins', () => {
    expect(resolveDossierTab({ tab: 'living', role: 'JOBCOACH', visible: ALL })).toBe('living')
  })

  it('ignores a tab the viewer may not see, or that does not exist', () => {
    const withoutDocs = ALL.filter((id) => id !== 'documents')
    expect(resolveDossierTab({ tab: 'documents', role: 'BETREUUNG', visible: withoutDocs })).toBe(
      'overview',
    )
    expect(resolveDossierTab({ tab: 'nonsense', role: 'JOBCOACH', visible: ALL })).toBe(
      'integration',
    )
  })

  it('a placement action opens housing, where its form is', () => {
    // The header's "Verlegen" links with ?action=transfer; landing on another
    // section would hide the form the button promised.
    expect(resolveDossierTab({ action: 'transfer', role: 'BETREUUNG', visible: ALL })).toBe(
      'housing',
    )
  })

  it('falls back to the first visible section when the role home is hidden', () => {
    expect(resolveDossierTab({ role: 'LIEGENSCHAFTEN', visible: ['overview', 'living'] })).toBe(
      'overview',
    )
  })
})
