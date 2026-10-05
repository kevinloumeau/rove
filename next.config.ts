import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // vinext treats any multipart POST as a possible server action and rejects bodies over this
    // limit (1 MB by default) before route handlers run. Photo imports send the original photo
    // plus a PNG per garment, so allow the import route's own maximum (12 MB + 8 × 8 MB).
    serverActions: { bodySizeLimit: "80mb" },
  },
};

export default nextConfig;
