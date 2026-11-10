import { logoutAction } from "@/app/actions";
import { Nav } from "@/components/Nav";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <Nav
        logout={
          <form action={logoutAction}>
            <button className="btn btn-sm w-full">Log out</button>
          </form>
        }
      />
      <main className="md:pl-52">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-40 md:px-8 md:pb-10">{children}</div>
      </main>
    </>
  );
}
