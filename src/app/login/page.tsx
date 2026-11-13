import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M12 9l11 7-11 7z" fill="#fff" /></svg>
          </div>
          <div>
            <div className="text-base font-semibold">Editing Hub</div>
            <div className="text-xs text-muted">Social Lab</div>
          </div>
        </div>
        <LoginForm next={next && next.startsWith("/") ? next : "/projects"} />
        <p className="mt-4 text-xs text-muted">No account? Ask an admin to add you from the Team page.</p>
      </div>
    </main>
  );
}
