import StaticInfoPage from '../../components/StaticInfoPage';

const ServiceRepair = () => {
  return (
    <StaticInfoPage
      category="Dịch vụ sửa chữa"
      title="Sửa chữa phần cứng, thay linh kiện và kiểm tra lỗi"
      intro="TECH-SHOP cung cấp dịch vụ kiểm tra và sửa chữa thiết bị với quy trình tiếp nhận rõ ràng, báo giá trước khi thực hiện và ưu tiên linh kiện phù hợp."
      highlights={[
        { label: 'Hạng mục', value: 'Điện thoại, laptop, phụ kiện' },
        { label: 'Quy trình', value: 'Kiểm tra - báo giá - sửa chữa' },
        { label: 'Cam kết', value: 'Minh bạch chi phí trước khi làm' },
      ]}
      sections={[
        {
          title: 'Hỗ trợ kỹ thuật',
          description: 'Dịch vụ bao gồm chẩn đoán lỗi nguồn, màn hình, pin, cổng sạc, bàn phím và một số lỗi phần cứng phổ biến.',
          items: [
            'Kiểm tra tình trạng máy và xác định nguyên nhân.',
            'Đề xuất phương án sửa, thay hoặc vệ sinh linh kiện.',
            'Bàn giao sau khi test lại chức năng cơ bản.',
          ],
        },
        {
          title: 'Lợi ích dịch vụ',
          description: 'Khách hàng có thể chủ động nắm tiến độ xử lý, chi phí dự kiến và tình trạng bảo hành sau sửa chữa.',
          items: [
            'Báo lỗi rõ ràng trước khi thực hiện.',
            'Ưu tiên linh kiện tương thích và nguồn gốc rõ ràng.',
            'Hướng dẫn sử dụng để hạn chế lỗi tái phát.',
          ],
        },
      ]}
      contactLabel="Bạn muốn đặt lịch kiểm tra máy?"
      contactValue="Hãy liên hệ TECH-SHOP để được tư vấn tình trạng và thời gian tiếp nhận."
    />
  );
};

export default ServiceRepair;