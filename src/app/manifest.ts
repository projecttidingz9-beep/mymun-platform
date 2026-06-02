import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tidingz",
    short_name: "Tidingz",
    description:
      "Discover, organize, and participate in Model UN conferences worldwide — marketplace, registration, and delegate tools.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f12",
    theme_color: "#0f1218",
    icons: [
      {
        src: "/brand/logo-icon-light.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/logo-icon-light.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
