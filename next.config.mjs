const githubPages = process.env.GITHUB_PAGES === 'true';

/** @type {import('vinext').NextConfig} */
export default {
  ...(githubPages
    ? { output: 'export', assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined }
    : {}),
};
