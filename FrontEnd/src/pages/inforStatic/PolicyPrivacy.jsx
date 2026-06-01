import StaticInfoPage from '../../components/StaticInfoPage';

const PolicyPrivacy = () => {
  return (
    <StaticInfoPage
      category="Bảo mật thông tin"
      title="Bảo vệ dữ liệu khách hàng là ưu tiên hàng đầu"
      intro="TECH-SHOP chỉ sử dụng thông tin cá nhân cho mục đích xử lý đơn hàng, chăm sóc khách hàng và cải thiện dịch vụ theo đúng chính sách công bố."
      highlights={[
        { label: 'Mục đích sử dụng', value: 'Xử lý đơn và hỗ trợ khách hàng' },
        { label: 'Phạm vi chia sẻ', value: 'Theo yêu cầu vận hành cần thiết' },
        { label: 'Cam kết', value: 'Không mua bán dữ liệu cá nhân' },
      ]}
      sections={[
        {
          title: 'Dữ liệu được thu thập',
          description: 'Thông tin thường gồm họ tên, số điện thoại, email, địa chỉ nhận hàng và lịch sử giao dịch để phục vụ quá trình mua sắm.',
          items: [
            'Thông tin tài khoản và liên hệ.',
            'Thông tin đơn hàng, thanh toán và giao nhận.',
            'Dữ liệu tương tác để cải thiện trải nghiệm sử dụng.',
          ],
        },
        {
          title: 'Quyền của khách hàng',
          description: 'Khách hàng có thể yêu cầu cập nhật, chỉnh sửa hoặc xóa thông tin theo phạm vi pháp luật và nhu cầu hỗ trợ hợp lệ.',
          items: [
            'Tra cứu thông tin đang được lưu trên hệ thống.',
            'Yêu cầu điều chỉnh dữ liệu khi phát hiện sai lệch.',
            'Từ chối nhận thông tin quảng cáo khi không còn nhu cầu.',
          ],
        },
      ]}
      contactLabel="Cần hỗ trợ liên quan đến dữ liệu cá nhân?"
      contactValue="Vui lòng liên hệ bộ phận chăm sóc khách hàng của TECH-SHOP để được hỗ trợ."
    />
  );
};

export default PolicyPrivacy;