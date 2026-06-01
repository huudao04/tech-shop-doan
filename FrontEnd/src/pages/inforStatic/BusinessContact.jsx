import StaticInfoPage from '../../components/StaticInfoPage';

const BusinessContact = () => {
  return (
    <StaticInfoPage
      category="Liên hệ hợp tác"
      title="Liên hệ hợp tác kinh doanh"
      intro="TECH-SHOP sẵn sàng trao đổi các cơ hội hợp tác phân phối, cung ứng sản phẩm, truyền thông và dịch vụ liên quan đến công nghệ."
      highlights={[
        { label: 'Lĩnh vực', value: 'Phân phối, truyền thông, dịch vụ' },
        { label: 'Mục tiêu', value: 'Hợp tác đôi bên cùng có lợi' },
        { label: 'Kênh liên hệ', value: 'Hotline, email, trực tiếp' },
      ]}
      sections={[
        {
          title: 'Nội dung hợp tác',
          description: 'Chúng tôi tiếp nhận trao đổi từ các đối tác có nhu cầu phối hợp kinh doanh hoặc cung cấp giải pháp phục vụ khách hàng công nghệ.',
          items: [
            'Hợp tác cung ứng hàng hóa và linh kiện.',
            'Chương trình truyền thông, affiliate hoặc đồng thương hiệu.',
            'Giải pháp dịch vụ hậu mãi, kỹ thuật và chăm sóc khách hàng.',
          ],
        },
        {
          title: 'Thông tin cần chuẩn bị',
          description: 'Để trao đổi hiệu quả, đối tác nên gửi ngắn gọn lĩnh vực quan tâm, quy mô hợp tác và thông tin người phụ trách liên hệ.',
          items: [
            'Tên đơn vị và người liên hệ.',
            'Mô tả nhu cầu hoặc đề xuất hợp tác.',
            'Số điện thoại, email và thời gian có thể trao đổi.',
          ],
        },
      ]}
      contactLabel="Bạn muốn gửi đề xuất hợp tác ngay?"
      contactValue="Liên hệ TECH-SHOP qua hotline 1900 1234 hoặc email support@techshop.com."
    />
  );
};

export default BusinessContact;