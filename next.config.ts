import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp의 libvips 공유 라이브러리(.so/.dylib)가 서버 trace에서 빠져 Vercel에서 로드에 실패한다 → Palm route에 명시 포함
  outputFileTracingIncludes: {
    '/api/palm/*': ['./node_modules/@img/sharp-libvips-*/lib/**/*'],
  },
};

export default nextConfig;
