import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from './AuthLayout'
import { signOut } from './session'

export function SinPerfilPage() {
  const navigate = useNavigate()
  return (
    <AuthLayout title="Cuenta sin perfil">
      <p className="text-sm">
        Tu cuenta no tiene un perfil activo en ninguna cadena. Pedile al administrador que te habilite y volvé a ingresar.
      </p>
      <Button
        className="mt-6"
        variant="secondary"
        onClick={async () => {
          await signOut()
          navigate('/login', { replace: true })
        }}
      >
        Cerrar sesión
      </Button>
    </AuthLayout>
  )
}
