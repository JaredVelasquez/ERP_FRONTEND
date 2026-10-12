import { lazy, Suspense, type ComponentType } from 'react'
import { useSession } from '@/app/providers/session'
import { visibleModules, type AppModule } from '@/modules/access'
import { shellMessages } from '@/shared/i18n/messages'

export function createGatedScreen(
  module: AppModule,
  load: () => Promise<{ Page: ComponentType }>,
) {
  const Page = lazy(() => load().then((mod) => ({ default: mod.Page })))

  return function GatedScreen() {
    const { grants } = useSession()
    const allowed = grants !== null && visibleModules(grants).includes(module)
    if (!allowed) {
      return (
        <p className="w-full max-w-md text-sm leading-6 text-stone-700" role="status">
          {shellMessages.signedOut}
        </p>
      )
    }
    return (
      <Suspense fallback={<p role="status">{shellMessages.loading}</p>}>
        <Page />
      </Suspense>
    )
  }
}
