import mongoose from 'mongoose';
import 'dotenv/config';

const connectDB = async () => {
  const dbURI = process.env.MONGODB_URI;

  if (!dbURI) {
    console.error("LỖI: Biến môi trường MONGODB_URI chưa được thiết lập!");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbURI);
    console.log('Đã kết nối cơ sở dữ liệu thành công! 🎉');
  } catch (err) {
    console.error('Lỗi kết nối MongoDB:', err);
    process.exit(1);
  }
};

export default connectDB;