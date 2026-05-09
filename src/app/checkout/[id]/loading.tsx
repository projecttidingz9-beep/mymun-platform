import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function CheckoutLoading() {
  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
          <div className="skeleton h-9 w-48 rounded-lg" />
          <div className="skeleton h-32 rounded-2xl w-full" />
          <div className="skeleton h-12 rounded-xl w-full" />
          <div className="skeleton h-12 rounded-xl w-full" />
        </div>
      </div>
      <Footer />
    </>
  );
}
