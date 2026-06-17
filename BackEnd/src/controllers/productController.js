import mongoose from 'mongoose';
import XLSX from 'xlsx';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Review from '../models/Review.js';
import cloudinary from '../config/cloudinary.js';
import { makeVietnameseRegex, calculateAutoPrice } from '../ultils/helpers.js';

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
    const currentPage = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (currentPage - 1) * pageSize;

    const totalProducts = await Product.countDocuments(query);

    let mongooseQuery = Product.find(query);
    if (sort === 'sold') mongooseQuery = mongooseQuery.sort({ sold: -1 });
    else if (sort === 'newest') mongooseQuery = mongooseQuery.sort({ createdAt: -1 });
    else mongooseQuery = mongooseQuery.sort({ createdAt: -1 });

    if (req.query.limit) mongooseQuery = mongooseQuery.limit(Number(req.query.limit));

    const products = await mongooseQuery;
    return res.json({
      products,
      totalProducts,
      currentPage,
      pageSize
    });
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
    const { name,  costPrice, price, pricingMethod, description, category, brand, stock, image } = req.body;
    const fileNames = Array.isArray(image) ? image : image ? [image] : (req.files ? req.files.map(f => f.path) : []);

    let finalPrice = Number(price);
    const autoCalculatedPrice = calculateAutoPrice(costPrice, pricingMethod);
    if (autoCalculatedPrice !== null) {
      finalPrice = autoCalculatedPrice;
    }

    const newProduct = new Product({ 
      name, 
      price: finalPrice,
      costPrice: Number(costPrice || 0), 
      pricingMethod: pricingMethod || 'manual',
      description, 
      category, 
      brand, 
      stock: Number(stock || 0), 
      image: fileNames 
    });
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
    const { name, costPrice, price, pricingMethod, description, category, brand, stock, image } = req.body;

    let finalPrice = Number(price);
    const autoCalculatedPrice = calculateAutoPrice(costPrice, pricingMethod || 'manual');
    if (autoCalculatedPrice !== null) {
      finalPrice = autoCalculatedPrice;
    }
    
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
    product.costPrice = Number(costPrice);
    product.price = finalPrice;
    product.pricingMethod = pricingMethod || 'manual';
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

export const importProductsExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng tải lên file Excel' });
    }

    // 1. Đọc file Excel từ buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Chuyển thành JSON mảng để kiểm tra dữ liệu, bắt đầu từ dòng 3 (range: 3)
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      range: 3
    });
    
    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: 'File Excel trống hoặc không đúng định dạng mẫu' });
    }

    const draftProducts = [];
    const errorRows = []; // Mảng chứa các dòng bị lỗi để xuất file phản hồi nếu có
    let hasError = false;

    // 2. Duyệt qua từng dòng dữ liệu để thẩm định (Validation)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = row["Tên sản phẩm (*)"];
      const costPrice = row["Giá nhập (*)"];
      const price = row["Giá bán"]; // 🌟 Đổi tên cột từ "Giá bán (*)" sang "Giá bán" (Không bắt buộc)
      const category = row["Danh mục (*)"];
      const brand = row["Thương hiệu (*)"];
      const stock = row["Số lượng (*)"];
      const imageNamesString = row["Hình ảnh"];
      const description = row["Mô tả sản phẩm"];

      // Tạo một danh sách các lý do lỗi cho dòng hiện tại
      let rowErrors = [];

      if (!name) rowErrors.push("Thiếu tên sản phẩm");
      if (!costPrice || isNaN(Number(costPrice)) || Number(costPrice) <= 0) {
        rowErrors.push("Giá nhập phải là số và lớn hơn 0");
      }
      
      // Kiểm tra định dạng giá bán NẾU người dùng có nhập
      if (price !== undefined && price !== null && price !== "") {
        if (isNaN(Number(price)) || Number(price) <= 0) {
          rowErrors.push("Giá bán nếu nhập phải là số và lớn hơn 0");
        }
      }

      if (!category) rowErrors.push("Thiếu danh mục");
      if (!brand) rowErrors.push("Thiếu thương hiệu");
      if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) rowErrors.push("Số lượng phải là số không âm");

      // Nếu dòng này có lỗi
      if (rowErrors.length > 0) {
        hasError = true;
        errorRows.push({
          ...row,
          "LÝ DO LỖI (VUI LÒNG SỬA)": rowErrors.join(" | ")
        });
      } else {
        // 🌟 LOGIC XỬ LÝ GIÁ TỰ ĐỘNG THEO YÊU CẦU:
        let finalPrice = 0;
        let finalPricingMethod = 'manual';

        // Nếu người dùng KHÔNG nhập giá bán (hoặc để chuỗi rỗng)
        if (price === undefined || price === null || String(price).trim() === "") {
          finalPricingMethod = 'auto_15'; // Đặt chế độ tự động 15%
          // Tính toán giá bán tự động: Giá nhập + 15%
          const autoCalculatedPrice = calculateAutoPrice(costPrice, 'auto_15');
          finalPrice = autoCalculatedPrice !== null ? autoCalculatedPrice : Number(costPrice) * 1.15;
        } else {
          // Nếu người dùng CÓ nhập giá bán cụ thể
          finalPricingMethod = 'manual';
          finalPrice = Number(price);
        }

        // Bóc tách danh sách file ảnh chờ đồng bộ
        let imagePlaceholders = [];
        if (imageNamesString) {
          imagePlaceholders = String(imageNamesString)
            .split(',')
            .map(img => img.trim().toLowerCase())
            .filter(img => img !== "");
        }

        draftProducts.push({
          name: String(name).trim(),
          costPrice: Number(costPrice),
          price: finalPrice, // Sử dụng giá đã qua xử lý logic
          pricingMethod: finalPricingMethod, // Lưu phương thức 'manual' hoặc 'auto_15'
          category: String(category).trim(),
          brand: String(brand).trim(),
          stock: Number(stock || 0),
          image: [],
          imageNamesPlaceholder: imagePlaceholders,
          description: String(description || '').trim(),
          status: imagePlaceholders.length > 0 ? 'draft' : 'active'
        });
      }
    }

    // 3. Xử lý phản hồi nếu có dòng dữ liệu lỗi
    if (hasError) {
      const errorWorksheet = XLSX.utils.json_to_sheet(errorRows);
      const errorWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(errorWorkbook, errorWorksheet, "Danh_Sach_Loi");

      const errorBuffer = XLSX.write(errorWorkbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=File_Loi_Import_San_Pham.xlsx');
      
      return res.status(422).send(errorBuffer);
    }

    // 4. Nếu toàn bộ dữ liệu hợp lệ, thực hiện lưu vào Database
    if (draftProducts.length > 0) {
      const savedProducts = await Product.insertMany(draftProducts);
      return res.json({ 
        success: true, 
        message: `Đã nhập dữ liệu thành công! Khởi tạo bản nháp cho ${savedProducts.length} sản phẩm.`,
        products: savedProducts 
      });
    }

    return res.status(400).json({ success: false, message: 'Không tìm thấy dữ liệu hợp lệ để xử lý.' });

  } catch (error) {
    console.error('Lỗi khi xử lý import excel:', error);
    return res.status(500).json({ success: false, message: 'Có lỗi xảy ra trong quá trình bóc tách file Excel' });
  }
};


/**
 * 🌟 API 2: Nhận kho ảnh cứng, upload Cloudinary và thực hiện so khớp tự động
 * URL: POST /api/products/match-images
 */
export const matchImages = async (req, res) => {
  try {
    const files = req.files || []; // Đống file ảnh cứng nhận từ Multer thông qua Cloudinary storage
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy file ảnh nào được gửi lên' });
    }

    // 1. Lấy toàn bộ danh sách sản phẩm đang ở trạng thái 'draft' để chuẩn bị đối chiếu
    const draftProducts = await Product.find({ status: 'draft' });
    if (draftProducts.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có sản phẩm bản nháp nào đang đợi ảnh' });
    }

    let matchCount = 0;

    // 2. Duyệt qua từng sản phẩm nháp
    for (let product of draftProducts) {
      let updatedImages = [...product.image];
      let placeholders = product.imageNamesPlaceholder || [];

      // Duyệt xem trong đống file admin vừa upload lên, có cái nào khớp với placeholder không
      for (const file of files) {
        // Multer có thuộc tính originalname lưu tên gốc file dưới máy admin (VD: "Iphone15-Front.JPG")
        const clientFileName = file.originalname.trim().toLowerCase();

        // Kiểm tra xem tên file này có nằm trong danh sách mong đợi của sản phẩm không
        if (placeholders.includes(clientFileName)) {
          // Nếu khớp, nhét URL thật từ Cloudinary (file.path) vào mảng image
          if (!updatedImages.includes(file.path)) {
            updatedImages.push(file.path);
          }
          matchCount++;
        }
      }

      // 3. Kiểm tra xem đã gom đủ ảnh cho sản phẩm này chưa
      // Nếu mảng ảnh thật thu thập được đã bằng hoặc lớn hơn số lượng tên ảnh khai báo trong Excel
      if (updatedImages.length >= placeholders.length && placeholders.length > 0) {
        product.status = 'active'; // Kích hoạt hiển thị sản phẩm ra trang chủ
        product.imageNamesPlaceholder = []; // Xóa mảng nháp để dọn rác dữ liệu
      }

      product.image = updatedImages;
      await product.save();
    }

    return res.json({
      success: true,
      message: `Đồng bộ ảnh hoàn tất! Đã so khớp thành công ${matchCount} file ảnh vào các sản phẩm tương ứng.`
    });

  } catch (error) {
    console.error('Lỗi khi so khớp ảnh:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống trong quá trình đồng bộ kho ảnh' });
  }
};

// Thêm API xóa hàng loạt sản phẩm
export const deleteProductsBulk = async (req, res) => {
  try {
    const { ids } = req.body; // Nhận mảng [id1, id2, id3...] từ Frontend
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID sản phẩm không hợp lệ' });
    }

    // 1. Lấy thông tin các sản phẩm để bóc tách ảnh cần xóa trên Cloudinary
    const products = await Product.find({ _id: { $in: ids } });
    
    let allCloudinaryPublicIds = [];
    products.forEach(product => {
      if (product.image && product.image.length > 0) {
        product.image.forEach(imageUrl => {
          if (imageUrl.includes('cloudinary.com')) {
            const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);
            if (publicId) allCloudinaryPublicIds.push(publicId);
          }
        });
      }
    });

    // 2. Tiến hành xóa ảnh trên Cloudinary nếu có
    if (allCloudinaryPublicIds.length > 0) {
      try {
        // Cloudinary hỗ trợ xóa tối đa 100 public_id cùng lúc bằng phương thức destroy/delete_resources
        await cloudinary.api.delete_resources(allCloudinaryPublicIds);
      } catch (err) {
        console.error('Lỗi khi xóa hàng loạt ảnh trên Cloudinary:', err);
        // Không return lỗi ở đây để tiếp tục giải phóng DB nếu ảnh có trục trặc
      }
    }

    // 3. Xóa các sản phẩm khỏi Database
    const result = await Product.deleteMany({ _id: { $in: ids } });

    return res.json({ 
      success: true, 
      message: `Đã xóa thành công ${result.deletedCount} sản phẩm và các ảnh liên quan!` 
    });
  } catch (error) {
    console.error('Bulk delete products error:', error);
    return res.status(500).json({ success: false, message: 'Không thể thực hiện xóa hàng loạt sản phẩm' });
  }
};