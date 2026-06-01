import StaticInfoPage from '../../components/StaticInfoPage';

const PolicyReturn = () => {
  return (
    <StaticInfoPage
      category="Chính sách đổi trả"
      title="Đổi trả 1-1 trong các trường hợp đủ điều kiện"
      intro="Chính sách đổi trả được xây dựng để bảo vệ quyền lợi khách hàng khi sản phẩm gặp lỗi kỹ thuật hoặc sai khác so với đơn đặt hàng."
      highlights={[
        { label: 'Thời gian đổi trả', value: 'Trong 7 ngày đầu' },
        { label: 'Điều kiện', value: 'Giữ hóa đơn, phụ kiện và hộp' },
        { label: 'Xử lý', value: 'Đổi mới hoặc hoàn theo quy định' },
      ]}
      sections={[
        {
          title: 'Trường hợp được hỗ trợ',
          description: 'Khách hàng được đổi trả khi sản phẩm lỗi do nhà sản xuất, giao sai mẫu, sai màu hoặc thiếu phụ kiện theo đơn hàng.',
          items: [
            'Sản phẩm còn nguyên tem, chưa bị can thiệp sửa chữa.',
            'Lỗi kỹ thuật được xác nhận bởi bộ phận kiểm tra của TECH-SHOP.',
            'Yêu cầu đổi trả phát sinh trong thời hạn hỗ trợ.',
          ],
        },
        {
          title: 'Lưu ý quan trọng',
          description: 'Mỗi nhóm sản phẩm có thể có điều kiện riêng từ nhà sản xuất nên việc đối chiếu hóa đơn và tình trạng sản phẩm là bắt buộc.',
          items: [
            'Sản phẩm khuyến mãi có thể áp dụng điều kiện riêng.',
            'Một số phụ kiện tiêu hao không thuộc phạm vi đổi mới 1-1.',
            'Chi phí phát sinh, nếu có, sẽ được thông báo trước khi xử lý.',
          ],
        },
      ]}
      contactLabel="Muốn kiểm tra sản phẩm có đủ điều kiện đổi trả?"
      contactValue="Gửi yêu cầu qua hotline hoặc mang sản phẩm đến quầy chăm sóc khách hàng."
    />
  );
};

export default PolicyReturn;