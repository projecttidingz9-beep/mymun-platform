import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/** Full-page loading skeleton for authenticated routes. */
export default function AppRouteSkeleton() {
  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
          <div className="skeleton h-8 w-56 rounded-lg" />
          <div className="skeleton h-12 w-full max-w-xl rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="skeleton h-40 rounded-2xl" />
            <div className="skeleton h-40 rounded-2xl" />
          </div>
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
      <Footer />
    </>
  );
}
