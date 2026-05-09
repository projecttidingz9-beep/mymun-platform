import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ConferenceLoading() {
  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
          <div className="skeleton h-14 w-3/4 max-w-xl rounded-xl" />
          <div className="skeleton aspect-[21/9] max-h-72 rounded-3xl w-full" />
          <div className="flex gap-2 flex-wrap">
            <div className="skeleton h-10 w-24 rounded-full" />
            <div className="skeleton h-10 w-24 rounded-full" />
            <div className="skeleton h-10 w-24 rounded-full" />
          </div>
          <div className="skeleton h-48 rounded-2xl w-full" />
        </div>
      </div>
      <Footer />
    </>
  );
}
