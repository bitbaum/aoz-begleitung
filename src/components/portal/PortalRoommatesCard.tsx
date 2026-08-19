import { SOCIAL_STYLE_LABELS, getLabel } from '@/lib/constants'
import { getScoreBgClass, getScoreLabel } from '@/lib/utils'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { ResidentAvatar } from '@/components/portal/ResidentAvatar'
import { residentName } from '@/lib/utils/resident-name'
import { getRequestTranslator } from '@/lib/i18n/request'

interface Roommate {
  id: string
  code: string
  displayName: string | null
  socialStyle: string | null
  photoVersion: Date | null
}

interface CompatibilityScore {
  residentId: string
  comparedWithId: string
  overallScore: number
}

interface PortalRoommatesCardProps {
  roommates: Roommate[]
  compatibilityScores: CompatibilityScore[]
}

export async function PortalRoommatesCard({ roommates, compatibilityScores }: PortalRoommatesCardProps) {
  const { t } = await getRequestTranslator()
  const preview = roommates.slice(0, DISPLAY_LIMITS.dashboardItems)

  function getScore(roommateId: string): number | null {
    const score = compatibilityScores.find(
      (s) => s.residentId === roommateId || s.comparedWithId === roommateId
    )
    return score ? score.overallScore : null
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ui-text mb-4">{t('dashboard.roommates')}</h2>
      <div className="space-y-3">
        {preview.map((roommate) => {
          const score = getScore(roommate.id)
          return (
            <div key={roommate.id} className="flex items-center gap-3">
              <ResidentAvatar resident={roommate} photoVersion={roommate.photoVersion} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ui-text truncate">{residentName(roommate)}</p>
                {roommate.socialStyle && (
                  <p className="text-sm text-ui-muted">
                    {getLabel(SOCIAL_STYLE_LABELS, roommate.socialStyle)}
                  </p>
                )}
              </div>
              {score !== null && (
                <span className={`badge ${getScoreBgClass(score)}`}>
                  {getScoreLabel(score)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
