export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('smartfuel_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('smartfuel_device_id', deviceId);
  }
  return deviceId;
};

export const getDeviceDescription = (): string => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Phone";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS Device";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/macintosh/i.test(ua)) return "Mac";
  return "Appareil Web";
};
