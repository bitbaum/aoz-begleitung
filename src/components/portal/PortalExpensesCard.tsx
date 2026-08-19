import Link from 'next/link'
import { getRequestTranslator } from '@/lib/i18n/request'
import { formatRappen } from '@/lib/expenses'

/** Dashboard widget: my net balance in the shared-expenses ledger. */
export async function PortalExpensesCard({ myBalance }: { myBalance: number }) {
  const { t } = await getRequestTranslator()

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ui-text">{t('expenses.dashboardTitle')}</h2>
        <Link
          href="/portal/expenses"
          className="inline-flex items-center min-h-[44px] px-1 text-sm text-brand-primary hover:underline"
        >
          {t('expenses.dashboardCta')}
        </Link>
      </div>
      <p className="eyebrow">{t('expenses.dashboardBalance')}</p>
      <div className="mt-2">
        {myBalance === 0 ? (
          <span className="chip-neutral">{t('expenses.balanceSettled')}</span>
        ) : myBalance > 0 ? (
          <span className="chip-success numeric">
            {t('expenses.balancePositive')} {formatRappen(myBalance)}
          </span>
        ) : (
          <span className="chip-error numeric">
            {t('expenses.balanceNegative')} {formatRappen(-myBalance)}
          </span>
        )}
      </div>
    </div>
  )
}
