import StaticInfoPage from '../../components/StaticInfoPage';

const ServiceInstallment = () => {
  return (
    <StaticInfoPage
      category="Dịch vụ trả góp"
      title="Mua sắm linh hoạt với ưu đãi trả góp 0%"
      intro="TECH-SHOP hỗ trợ khách hàng sở hữu sản phẩm mong muốn bằng hình thức trả góp linh hoạt, giúp tối ưu dòng tiền mà vẫn đảm bảo trải nghiệm mua sắm."
      highlights={[
        { label: 'Lãi suất', value: '0% theo chương trình' },
        { label: 'Thủ tục', value: 'Nhanh gọn, hỗ trợ tại quầy' },
        { label: 'Áp dụng', value: 'Theo sản phẩm và đối tác tài chính' },
      ]}
      sections={[
        {
          title: 'Điều kiện tham gia',
          description: 'Mỗi chương trình trả góp sẽ có quy định riêng về giá trị đơn hàng, loại sản phẩm và giấy tờ cần thiết.',
          items: [
            'Khách hàng cần cung cấp thông tin định danh hợp lệ.',
            'Một số sản phẩm hoặc ưu đãi có thể không áp dụng đồng thời.',
            'Phê duyệt phụ thuộc vào đối tác tài chính.',
          ],
        },
        {
          title: 'Quy trình đăng ký',
          description: 'Nhân viên sẽ tư vấn gói trả góp phù hợp, xác nhận hồ sơ và hỗ trợ khách hàng hoàn thiện thủ tục nhanh chóng.',
          items: [
            'Chọn sản phẩm và kiểm tra chương trình áp dụng.',
            'Nhận tư vấn hạn mức, kỳ hạn và khoản trả trước.',
            'Hoàn tất hồ sơ và nhận máy sau khi duyệt.',
          ],
        },
      ]}
      contactLabel="Cần tư vấn gói trả góp phù hợp?"
      contactValue="Đến TECH-SHOP để được hỗ trợ các phương án trả góp đang áp dụng."
    />
  );
};

export default ServiceInstallment;