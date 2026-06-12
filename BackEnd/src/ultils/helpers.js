export const notImplemented = (res, message = 'Chức năng chưa được triển khai.') => {
  return res.status(501).json({ success: false, message });
};

export const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const makeVietnameseRegex = (keyword) => {
  let str = keyword.toLowerCase().trim();
  str = str.replace(/[aàáạảãâầấậẩẫăằắặẳẵ]/g, '[aàáạảãâầấậẩẫăằắặẳẵ]');
  str = str.replace(/[eèéẹẻẽêềếệểễ]/g, '[eèéẹẻẽêềếệểễ]');
  str = str.replace(/[iìíịỉĩ]/g, '[iìíịỉĩ]');
  str = str.replace(/[oòóọỏõôồốộổỗơờớợởỡ]/g, '[oòóọỏõôồốộổỗơờớợởỡ]');
  str = str.replace(/[uùúụủũưừứựửữ]/g, '[uùúụủũưừứựửữ]');
  str = str.replace(/[yỳýỵỷỹ]/g, '[yỳýỵỷỹ]');
  str = str.replace(/[dđ]/g, '[dđ]');
  return new RegExp(str, 'i');
};

export const removeVietnameseTones = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};
