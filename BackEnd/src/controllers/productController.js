import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Review from '../models/Review.js';
import cloudinary from '../config/cloudinary.js';
import { makeVietnameseRegex } from '../ultils/helpers.js';

export const getProducts = async (req, res) => {
  try {
    const { search, category, brand, minPrice, maxPrice, sort, limit } = req.query;
    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (category) query.category = { $in: String(category).split(',') };
    if (brand) query.brand = { $in: String(brand).split(',') };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let mongooseQuery = Product.find(query);
    if (sort === 'sold') mongooseQuery = mongooseQuery.sort({ sold: -1 });
    else if (sort === 'newest') mongooseQuery = mongooseQuery.sort({ createdAt: -1 });
    else mongooseQuery = mongooseQuery.sort({ createdAt: -1 });

    if (limit) mongooseQuery = mongooseQuery.limit(Number(limit));

    const products = await mongooseQuery;
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách sản phẩm' });
  }
};

export const searchSuggest = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const searchRegex = makeVietnameseRegex(q);
    const products = await Product.find({ name: { $regex: searchRegex } })
      .select('_id name price image')
      .limit(10);

    return res.json(products);
  } catch (error) {
    console.error('Lỗi tìm kiếm gợi ý:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}, 'name slug').sort({ name: 1 }).lean();
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tải danh mục' });
  }
};

export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({}, 'name slug').sort({ name: 1 }).lean();
    return res.json(brands);
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tải thương hiệu' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    const reviews = await Review.find({ productId: new mongoose.Types.ObjectId(req.params.id) })
      .sort({ createdAt: -1 });

    return res.json({ product, reviews });
  } catch (error) {
    return res.status(500).json({ message: 'ID sản phẩm không hợp lệ hoặc lỗi hệ thống' });
  }
};

// [ADMIN] Upload images helper (files are uploaded directly to Cloudinary by multer)
export const uploadImages = async (req, res) => {
  try {
    const fileNames = (req.files || []).map(f => f.path);
    return res.json({ success: true, fileNames });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể upload ảnh sản phẩm lên Cloudinary' });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name, price, description, category, brand, stock, image } = req.body;
    const fileNames = Array.isArray(image) ? image : image ? [image] : (req.files ? req.files.map(f => f.path) : []);

    const newProduct = new Product({ name, price: Number(price), description, category, brand, stock: Number(stock || 0), image: fileNames });
    await newProduct.save();
    return res.status(201).json({ success: true, message: 'Thêm sản phẩm thành công!', product: newProduct });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ success: false, message: 'Không thể thêm sản phẩm' });
  }
};

const extractPublicIdFromCloudinaryUrl = (imageUrl) => {
  try {
    const urlParts = imageUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex === -1) return null;
    const hasVersion = urlParts[uploadIndex + 1]?.startsWith?.('v');
    const startIndex = hasVersion ? uploadIndex + 2 : uploadIndex + 1;
    const publicIdWithExt = urlParts.slice(startIndex).join('/');
    return publicIdWithExt.split('.').slice(0, -1).join('.') || publicIdWithExt.split('.').slice(0, -1).join('.');
  } catch (e) {
    return null;
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { name, price, description, category, brand, stock, image } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    let keptImages = [];
    if (Array.isArray(image)) keptImages = image;
    else if (image) keptImages = [image];

    const newUploadedImages = (req.files || []).map(f => f.path);
    const finalImages = [...keptImages, ...newUploadedImages];

    const imagesToDelete = product.image.filter(oldUrl => !finalImages.includes(oldUrl));
    if (imagesToDelete.length > 0) {
      for (const imageUrl of imagesToDelete) {
        try {
          if (imageUrl.includes('cloudinary.com')) {
            const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);
            if (publicId) await cloudinary.uploader.destroy(publicId);
          }
        } catch (err) {
          console.error('Lỗi khi xóa ảnh thừa trên Cloudinary:', err);
        }
      }
    }

    product.name = name;
    product.price = Number(price);
    product.description = description;
    product.category = category;
    product.brand = brand;
    product.stock = Number(stock || 0);
    product.image = finalImages;
    await product.save();

    return res.json({ success: true, message: 'Cập nhật sản phẩm và đồng bộ ảnh thành công!', product });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi cập nhật sản phẩm' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    if (product.image && product.image.length > 0) {
      for (const imageUrl of product.image) {
        try {
          if (imageUrl.includes('cloudinary.com')) {
            const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);
            if (publicId) await cloudinary.uploader.destroy(publicId);
          }
        } catch (err) {
          console.error('Lỗi khi xóa 1 ảnh trên Cloudinary:', err);
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Xóa sản phẩm và các ảnh liên quan thành công!' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ success: false, message: 'Không thể xóa sản phẩm' });
  }
};
