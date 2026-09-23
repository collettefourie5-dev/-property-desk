export default function AdminForbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-neutral-600">Your account doesn&rsquo;t have permission to view this page.</p>
    </main>
  );
}
