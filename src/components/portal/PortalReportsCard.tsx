import Link from 'next/link'
import { getRequestTranslator } from '@/lib/i18n/request'
import { RESIDENT_REPORTS_ANCHOR, type ResidentReport } from '@/lib/reports/resident-reports'
import { ResidentReportItem } from './ResidentReportItem'

interface PortalReportsCardProps {
  reports: ResidentReport[]
  /**
   * How many the resident actually has. The card shows a preview, so without
   * the true count it cannot say that there are more — which is how reports
   * past the preview limit became unreachable.
   */
  totalCount: number
}

export async function PortalReportsCard({ reports, totalCount }: PortalReportsCardProps) {
  const { t } = await getRequestTranslator()
  const hasMore = totalCount > reports.length

  return (
    <div className="card" id={RESIDENT_REPORTS_ANCHOR}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ui-text">{t('dashboard.myReports')}</h2>
        <Link href="/portal/report" className="inline-flex items-center min-h-[44px] px-1 text-sm text-brand-primary hover:underline">
          {t('dashboard.newReport')}
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-ui-muted text-center py-6">
          {t('dashboard.noReports')}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((report) => (
              <ResidentReportItem
                key={`${report.kind}-${report.id}`}
                report={report}
                truncate
              />
            ))}
          </div>

          {/* The way out of the preview. Its absence is what made the sixth
              report unreachable from anywhere in the product. */}
          <Link
            href="/portal/reports"
            className="mt-4 inline-flex items-center min-h-[44px] text-sm text-brand-primary hover:underline"
          >
            {hasMore
              ? `${t('reports.showAllCount')} (${totalCount})`
              : t('reports.showAll')}
          </Link>
        </>
      )}
    </div>
  )
}
