import type { ProfileVisibility } from '@/lib/db'
import type { Translator } from './index'

export function formatMarkPaidConfirm(t: Translator, amount: string, name: string): string {
  return t('expenses.markPaidConfirm').replace('«0»', amount).replace('«1»', name)
}

/** Expense page labels — mirrors former PORTAL_LABELS.expenses shape. */
export function buildExpenseLabels(t: Translator) {
  return {
    title: t('expenses.title'),
    subtitle: t('expenses.subtitle'),
    balancesTitle: t('expenses.balancesTitle'),
    balancePositive: t('expenses.chipGets'),
    balanceNegative: t('expenses.chipOwes'),
    balanceSettled: t('expenses.chipSettled'),
    suggestedTitle: t('expenses.suggestedTitle'),
    suggestedPays: t('expenses.suggestedPays'),
    noDebts: t('expenses.noDebts'),
    markPaid: t('expenses.markPaid'),
    markPaidConfirm: (amount: string, name: string) => formatMarkPaidConfirm(t, amount, name),
    addTitle: t('expenses.addTitle'),
    descriptionLabel: t('expenses.descriptionLabel'),
    descriptionPlaceholder: t('expenses.descriptionPlaceholder'),
    amountLabel: t('expenses.amountLabel'),
    amountPlaceholder: t('expenses.amountPlaceholder'),
    amountInvalid: t('expenses.amountInvalid'),
    categoryLabel: t('expenses.categoryLabel'),
    dateLabel: t('expenses.dateLabel'),
    paidByLabel: t('expenses.paidByLabel'),
    participantsLabel: t('expenses.participantsLabel'),
    participantsHint: t('expenses.participantsHint'),
    submit: t('expenses.submit'),
    historyTitle: t('expenses.historyTitle'),
    settlementsTitle: t('expenses.settlementsTitle'),
    delete: t('expenses.delete'),
    deleteConfirm: t('expenses.deleteConfirm'),
    empty: t('expenses.empty'),
    emptyHint: t('expenses.emptyHint'),
    paidBy: t('expenses.paidBy'),
    you: t('expenses.you'),
    settlementNoteLabel: t('expenses.settlementNoteLabel'),
    settlementRecorded: t('expenses.settlementRecorded'),
    createdToast: t('expenses.createdToast'),
    settledToast: t('expenses.settledToast'),
    deletedToast: t('expenses.deletedToast'),
    splitAcross: t('expenses.splitAcross'),
    splitAll: t('expenses.splitAll'),
    each: t('expenses.each'),
    recordedBy: t('expenses.recordedBy'),
    statementTitle: t('expenses.statementTitle'),
    statementSubtitle: t('expenses.statementSubtitle'),
    statementPerson: t('expenses.statementPerson'),
    statementPaid: t('expenses.statementPaid'),
    statementShare: t('expenses.statementShare'),
    statementNet: t('expenses.statementNet'),
    statementTotal: t('expenses.statementTotal'),
    statementExpenses: t('expenses.statementExpenses'),
    statementNetHint: t('expenses.statementNetHint'),
  }
}

export type ExpenseLabels = ReturnType<typeof buildExpenseLabels>

export function buildTransferLabels(t: Translator) {
  return {
    subtitle: t('transfer.subtitle'),
    reasonLabel: t('transfer.reasonLabel'),
    reasonPlaceholder: t('transfer.reasonPlaceholder'),
    targetUnitLabel: t('transfer.targetUnitLabel'),
    targetUnitPlaceholder: t('transfer.targetUnitPlaceholder'),
    submit: t('transfer.submit'),
    submitting: t('transfer.submitting'),
    pendingTitle: t('transfer.pendingTitle'),
    pendingMessage: t('transfer.pendingMessage'),
    noPlacement: t('transfer.noPlacement'),
    successTitle: t('transfer.successTitle'),
    successMessage: t('transfer.successMessage'),
    successNextStepsTitle: t('transfer.successNextStepsTitle'),
    successNextSteps: [
      t('transfer.successNextStep1'),
      t('transfer.successNextStep2'),
      t('transfer.successNextStep3'),
    ],
    successToMessages: t('transfer.successToMessages'),
    successToOverview: t('transfer.successToOverview'),
    currentUnit: t('transfer.currentUnit'),
    decisionTitle: t('transfer.decisionTitle'),
    yourReason: t('transfer.yourReason'),
    staffNote: t('transfer.staffNote'),
    decidedOn: t('transfer.decidedOn'),
  }
}

export type TransferLabels = ReturnType<typeof buildTransferLabels>

export function buildProfileLabels(t: Translator) {
  return {
    title: t('profile.title'),
    subtitle: t('profile.subtitle'),
    codeLabel: t('profile.codeLabel'),
    codeHint: t('profile.codeHint'),
    displayNameLabel: t('profile.displayNameLabel'),
    displayNamePlaceholder: t('profile.displayNamePlaceholder'),
    bioLabel: t('profile.bioLabel'),
    bioPlaceholder: t('profile.bioPlaceholder'),
    photoLabel: t('profile.photoLabel'),
    photoUpload: t('profile.photoUpload'),
    photoRemove: t('profile.photoRemove'),
    photoHint: t('profile.photoHint'),
    visibleTo: t('profile.visibleTo'),
    savedToast: t('profile.savedToast'),
    photoUpdatedToast: t('profile.photoUpdatedToast'),
    photoRemovedToast: t('profile.photoRemovedToast'),
    visibilityLabel: t('profile.visibilityLabel'),
    visibilityStaffNote: t('profile.visibilityStaffNote'),
    visibilityOptions: {
      PRIVATE: t('profile.visibility.PRIVATE'),
      ROOMMATES: t('profile.visibility.ROOMMATES'),
      RESIDENTS: t('profile.visibility.RESIDENTS'),
    } satisfies Record<ProfileVisibility, string>,
    visibilityHints: {
      PRIVATE: t('profile.visibilityHint.PRIVATE'),
      ROOMMATES: t('profile.visibilityHint.ROOMMATES'),
      RESIDENTS: t('profile.visibilityHint.RESIDENTS'),
    } satisfies Record<ProfileVisibility, string>,
  }
}

export type ProfileLabels = ReturnType<typeof buildProfileLabels>

export function buildPreferencesLabels(t: Translator) {
  return {
    saving: t('preferences.saving'),
    saveButton: t('preferences.saveButton'),
    successTitle: t('preferences.successTitle'),
    successMessage: t('preferences.successMessage'),
    errorGeneric: t('preferences.errorGeneric'),
    privacyTitle: t('preferences.privacyTitle'),
    privacyMessage: t('preferences.privacyMessage'),
    saveTip: t('preferences.saveTip'),
    unsavedChanges: t('preferences.unsavedChanges'),
    confirmDiscard: t('preferences.confirmDiscard'),
    confirmDiscardBody: t('preferences.confirmDiscardBody'),
    confirmDiscardConfirm: t('preferences.confirmDiscardConfirm'),
    sections: {
      lifestyle: t('preferences.section.lifestyle'),
      social: t('preferences.section.social'),
      practical: t('preferences.section.practical'),
      roommatePrefs: t('preferences.section.roommatePrefs'),
    },
    fields: {
      sleepSchedule: t('preferences.field.sleepSchedule'),
      noiseTolerance: t('preferences.field.noiseTolerance'),
      cleanlinessPractice: t('preferences.field.cleanlinessPractice'),
      cleanlinessExpectation: t('preferences.field.cleanlinessExpectation'),
      chaosTolerance: t('preferences.field.chaosTolerance'),
      socialStyle: t('preferences.field.socialStyle'),
      privacyNeed: t('preferences.field.privacyNeed'),
      languages: t('preferences.field.languages'),
      smoking: t('preferences.field.smoking'),
      petTolerance: t('preferences.field.petTolerance'),
      sharedBathroom: t('preferences.field.sharedBathroom'),
      sharedKitchen: t('preferences.field.sharedKitchen'),
      diet: t('preferences.field.diet'),
      preferredAgeRange: t('preferences.field.preferredAgeRange'),
      noPref: t('preferences.field.noPref'),
      similarAge: t('preferences.field.similarAge'),
      additionalPrefs: t('preferences.field.additionalPrefs'),
    },
    hints: {
      noiseTolerance: t('preferences.hint.noiseTolerance'),
      cleanlinessPractice: t('preferences.hint.cleanlinessPractice'),
      cleanlinessExpectation: t('preferences.hint.cleanlinessExpectation'),
      chaosTolerance: t('preferences.hint.chaosTolerance'),
      privacyNeed: t('preferences.hint.privacyNeed'),
      languages: t('preferences.hint.languages'),
      roommatePrefs: t('preferences.hint.roommatePrefs'),
      additionalPrefsPlaceholder: t('preferences.hint.additionalPrefsPlaceholder'),
    },
  }
}

export type PreferencesLabels = ReturnType<typeof buildPreferencesLabels>

export function buildApartmentLabels(t: Translator) {
  return {
    title: t('apartment.title'),
    subtitle: t('apartment.subtitle'),
    nameLabel: t('apartment.nameLabel'),
    namePlaceholder: t('apartment.namePlaceholder'),
    nameHint: t('apartment.nameHint'),
    nameEdit: t('apartment.nameEdit'),
    nameSave: t('apartment.nameSave'),
    unnamed: t('apartment.unnamed'),
    address: t('apartment.address'),
    roomsTitle: t('apartment.roomsTitle'),
    roomFallback: t('apartment.roomFallback'),
    freeBed: t('apartment.freeBed'),
    residentsTitle: t('apartment.residentsTitle'),
    quietHours: t('apartment.quietHours'),
  }
}

export type ApartmentLabels = ReturnType<typeof buildApartmentLabels>

export function buildHousingBrowseLabels(t: Translator) {
  return {
    compatibility: t('housingBrowse.compatibility'),
    spots: t('housingBrowse.spots'),
    currentRoommates: t('housingBrowse.currentRoommates'),
    strengths: t('housingBrowse.strengths'),
    concerns: t('housingBrowse.concerns'),
    emptyUnit: t('housingBrowse.emptyUnit'),
    noMatches: t('housingBrowse.noMatches'),
    contactHint: t('housingBrowse.contactHint'),
    features: {
      sharedKitchen: t('housingBrowse.sharedKitchen'),
      privateKitchen: t('housingBrowse.privateKitchen'),
      smokingAllowed: t('housingBrowse.smokingAllowed'),
      noSmoking: t('housingBrowse.noSmoking'),
      petsAllowed: t('housingBrowse.petsAllowed'),
      wheelchairAccess: t('housingBrowse.wheelchairAccess'),
      groundFloor: t('housingBrowse.groundFloor'),
      elevator: t('housingBrowse.elevator'),
    },
  }
}

export type HousingBrowseLabels = ReturnType<typeof buildHousingBrowseLabels>

/** Dashboard report/maintenance copy for portal cards. */
export function buildDashboardReportLabels(t: Translator) {
  return {
    showAll: t('action.showAll'),
    openMaintenance: t('dashboard.openMaintenance'),
    reported: t('dashboard.reported'),
    reportPending: t('dashboard.reportPending'),
    reportAnswer: t('dashboard.reportAnswer'),
    reportResolved: t('dashboard.reportResolved'),
    open: t('dashboard.open'),
    inProgress: t('dashboard.inProgress'),
    noHousingContact: t('dashboard.noHousingContact'),
  }
}

export function buildPendingChoresLabels(t: Translator) {
  return {
    title: t('pendingChores.title'),
    requestOpen: t('pendingChores.requestOpen'),
  }
}
