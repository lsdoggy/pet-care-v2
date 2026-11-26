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
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (!googleServicesFile && process.env.EAS_BUILD === 'true' &&
      process.env.EAS_BUILD_PROFILE === 'preview' && process.env.EAS_BUILD_PLATFORM === 'android') {
    throw new Error('Set the GOOGLE_SERVICES_JSON file environment variable for the preview build.');
  }
  if (process.env.PETCARE_ANDROID_CI === 'true') {
    return {
      ...config,
      name: 'Pet Care CI',
      android: { ...config.android, package: `${config.android.package}.ci` },
    };
  }
  return googleServicesFile
    ? { ...config, android: { ...config.android, googleServicesFile } }
    : config;
};
