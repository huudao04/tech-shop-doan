import StaticInfoPage from '../../components/StaticInfoPage';

const PolicyWarranty = () => {
  return (
    <StaticInfoPage
      category="Chính sách bảo hành"
      title="Điều kiện và quy trình bảo hành"
      intro="TECH-SHOP ưu tiên xử lý bảo hành nhanh, rõ ràng và minh bạch để khách hàng yên tâm sử dụng sản phẩm chính hãng."
      highlights={[
        { label: 'Thời gian tiếp nhận', value: 'T2 - T7, 8:00 - 17:30' },
        { label: 'Kênh hỗ trợ', value: 'Cửa hàng, hotline, Zalo' },
        { label: 'Cam kết', value: 'Xử lý đúng chính sách hãng' },
      ]}
      sections={[
        {
          title: 'Điều kiện áp dụng',
          description: 'Sản phẩm được bảo hành khi còn thời hạn, có hóa đơn hoặc thông tin mua hàng hợp lệ và lỗi phát sinh từ nhà sản xuất.',
          items: [
            'Tem niêm phong, serial và phụ kiện chính còn nguyên trạng.',
            'Không bị cháy nổ, vô nước, cấn móp nặng hoặc tự ý tháo lắp.',
            'Thời hạn bảo hành theo quy định từng thương hiệu hoặc từng nhóm sản phẩm.',
          ],
        },
        {
          title: 'Quy trình xử lý',
          description: 'Khi tiếp nhận sản phẩm, đội ngũ sẽ kiểm tra tình trạng, xác định lỗi và thông báo hướng xử lý cụ thể cho khách hàng.',
          items: [
            'Tiếp nhận thông tin và xác minh đơn hàng.',
            'Kiểm tra tình trạng thực tế của thiết bị.',
            'Chuyển hãng, sửa chữa hoặc đổi theo điều kiện áp dụng.',
          ],
        },
      ]}
      contactLabel="Cần hỗ trợ bảo hành nhanh?"
      contactValue="Liên hệ hotline 1900 1234 hoặc đến trực tiếp cửa hàng TECH-SHOP."
    />
  );
};

export default PolicyWarranty;