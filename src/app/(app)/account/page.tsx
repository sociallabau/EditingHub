import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/utils";
import { PasswordForm } from "@/components/admin/PasswordForm";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-line px-4 py-2.5">
        <h1 className="text-sm font-semibold">Account</h1>
      </header>
      <div className="mx-auto max-w-md space-y-4 p-6">
        <div>
          <div className="text-[15px] font-semibold">{user.name}</div>
          <div className="text-xs text-muted">{user.email} · {ROLE_LABEL[user.role]}</div>
        </div>
        <PasswordForm />
      </div>
    </div>
  );
}
