export const getImageUrl = (image, fallback = '') => {
  const source = Array.isArray(image) ? image[0] : image;

  if (!source || typeof source !== 'string') {
    return fallback;
  }

  if (/^https?:\/\//i.test(source) || source.startsWith('//')) {
    return source;
  }

  if (source.startsWith('/')) {
    return source;
  }

  return `/images/${source}`;
};