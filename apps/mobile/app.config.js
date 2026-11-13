module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'preview') {
    const value = process.env.EXPO_PUBLIC_API_URL;
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Set EXPO_PUBLIC_API_URL to the public HTTPS API origin.');
    }
    if (url.protocol !== 'https:' || url.origin !== value) {
      throw new Error('Use an HTTPS origin without a path or trailing slash for EXPO_PUBLIC_API_URL.');
    }
  }
  return config;
};
