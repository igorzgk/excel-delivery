import { join } from "path";
const uploadsDir = join(process.cwd(), "uploads");

const config = {
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/uploads/:path*" },
    ];
  },
};

export default config;
