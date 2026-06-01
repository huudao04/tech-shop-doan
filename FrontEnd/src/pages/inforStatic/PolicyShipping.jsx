import StaticInfoPage from '../../components/StaticInfoPage';

const PolicyShipping = () => {
  return (
    <StaticInfoPage
      category="Chính sách giao hàng"
      title="Giao hàng tận nơi nhanh, an toàn và có thể theo dõi"
      intro="TECH-SHOP hỗ trợ giao hàng linh hoạt theo khu vực, với trạng thái đơn hàng được cập nhật rõ ràng để khách hàng dễ theo dõi."
      highlights={[
        { label: 'Nội thành', value: 'Giao nhanh trong ngày' },
        { label: 'Ngoại tỉnh', value: 'Từ 1 - 4 ngày làm việc' },
        { label: 'Theo dõi đơn', value: 'Cập nhật qua hệ thống' },
      ]}
      sections={[
        {
          title: 'Phạm vi giao hàng',
          description: 'Chúng tôi hỗ trợ giao tại hầu hết các tỉnh thành thông qua đối tác vận chuyển và đội giao nội bộ ở khu vực gần cửa hàng.',
          items: [
            'Đơn nội thành được ưu tiên xử lý nhanh.',
            'Khu vực xa sẽ phụ thuộc vào đơn vị vận chuyển.',
            'Khách hàng có thể kiểm tra trạng thái đơn trong tài khoản.',
          ],
        },
        {
          title: 'Kiểm tra khi nhận hàng',
          description: 'Khách hàng nên kiểm tra ngoại quan, số lượng phụ kiện và tình trạng niêm phong trước khi ký nhận để đảm bảo quyền lợi đổi trả.',
          items: [
            'Kiểm tra hộp, phụ kiện và tình trạng tem niêm phong.',
            'Quay video mở hộp nếu đơn hàng giá trị cao.',
            'Báo ngay cho đơn vị giao hàng hoặc chăm sóc khách hàng nếu có bất thường.',
          ],
        },
      ]}
      contactLabel="Cần hỏi phí hoặc tiến độ giao hàng?"
      contactValue="Liên hệ TECH-SHOP để được báo trạng thái đơn và thời gian dự kiến nhận hàng."
    />
  );
};

export default PolicyShipping;