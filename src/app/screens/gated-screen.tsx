import { lazy, Suspense, type ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import { useSession } from '@/app/providers/session'
import { visibleModules, type AppModule } from '@/modules/access'
import { shellMessages } from '@/shared/i18n/messages'
import { PageLoadingSkeleton } from '@/shared/ui/skeleton'

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
        <section className="session-expired" aria-labelledby="session-expired-title">
          <p id="session-expired-title" className="text-sm leading-6 text-stone-700" role="status">
            {shellMessages.signedOut}
          </p>
          <Link className="ui-button ui-button--primary" to="/">
            Volver al inicio de sesión
          </Link>
        </section>
      )
    }
    return (
      <Suspense fallback={<PageLoadingSkeleton />}>
        <Page />
      </Suspense>
    )
  }
}
