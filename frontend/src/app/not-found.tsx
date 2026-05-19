import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="error-page-code">404</div>
      <h1 className="error-page-title">Page not found</h1>
      <p className="error-page-sub">
        The page you&apos;re looking for doesn&apos;t exist, or the wind took it somewhere else.
      </p>
      <Link href="/" className="btn btn-primary">Back to Home</Link>
    </div>
  );
}
