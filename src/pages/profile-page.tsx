import { useAppSelector } from "@/app/hooks"
import { ProfileDetailsCard } from "@/features/profile/profile-details-card"
import { ProfileSummaryCard } from "@/features/profile/profile-summary-card"

export function ProfilePage() {
  const user = useAppSelector((state) => state.auth.user)

  if (!user) return null

  return (
    <div className="space-y-6">
      <ProfileSummaryCard user={user} />
      <ProfileDetailsCard user={user} />
    </div>
  )
}
