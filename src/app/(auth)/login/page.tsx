import { LoginButton } from './LoginButton'

export default function LoginPage() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <div className="text-5xl">💰</div>
          <h1 className="text-3xl font-bold tracking-tight">VARITO</h1>
          <p className="text-muted-foreground text-sm">
            Controla tus gastos, tarjetas y pagos MSI
          </p>
        </div>
        <LoginButton />
        <p className="text-muted-foreground text-xs">
          Tus datos son privados y solo tú puedes verlos.
        </p>
      </div>
    </main>
  )
}
