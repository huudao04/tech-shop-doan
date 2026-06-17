export const calculateAutoPrice = (costPrice, pricingMethod) => {
  const cost = Number(costPrice || 0);
  
  // Nếu là manual hoặc không có phương thức hợp lệ, giữ nguyên không tính tự động
  if (!pricingMethod || pricingMethod === 'manual') return null;

  // Bóc tách số phần trăm từ chuỗi (VD: 'auto_15' -> 15)
  const percentStr = pricingMethod.split('_')[1];
  const percent = parseInt(percentStr, 10);

  if (isNaN(percent)) return null;

  // Công thức: Giá bán = Giá nhập + (Giá nhập * % / 100)
  return cost + (cost * percent / 100);
};

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
