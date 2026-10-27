import { useSession } from '@/app/providers/session'
import { Link } from '@tanstack/react-router'
import { PageIntro, Panel } from '@/shared/ui/ops'

export function PlatformPage() {
  const { companyName, logoUrl } = useSession()
  return (
    <div className="ops-page platform-page">
      <PageIntro title="Plataforma" description="Vista general de la empresa activa." />
      <div className="platform-overview">
        <Panel title="Empresa activa">
          <div className="company-profile">
            {logoUrl ? <img src={logoUrl} alt="" /> : <span aria-hidden="true">M</span>}
            <div><strong>{companyName || 'Empresa'}</strong><small>Sesión de tienda activa</small></div>
          </div>
          <p className="section-copy">La administración de empresas se trasladará al panel general de ARQUIGRAPHIA. Los datos de esta ficha son de consulta.</p>
        </Panel>
        <Panel title="Acceso">
          <p>Los usuarios, permisos y conexiones de esta empresa se administran en Configuración.</p>
          <Link to="/settings" className="ui-button ui-button--primary">Abrir configuración</Link>
        </Panel>
      </div>
    </div>
  )
}
