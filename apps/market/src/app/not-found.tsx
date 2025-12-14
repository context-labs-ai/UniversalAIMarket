import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-2xl font-semibold text-white/90">404</h1>
      <p className="mt-2 text-sm text-white/60">页面不存在。</p>
      <Link
        href="/"
        className="mt-6 inline-flex glass-panel rounded-lg px-3 py-1.5 text-sm text-white/80 hover:text-white"
      >
        返回市场
      </Link>
    </main>
  );
}

