import StaticInfoPage from '../../components/StaticInfoPage';

const TechNews = () => {
  return (
    <StaticInfoPage
      category="Tin tức công nghệ"
      title="Tin tức công nghệ mới nhất"
      intro="Khu vực này tổng hợp các xu hướng, sản phẩm và thông tin công nghệ mới để khách hàng dễ theo dõi trước khi chọn mua sản phẩm phù hợp."
      highlights={[
        { label: 'Cập nhật', value: 'Theo xu hướng thị trường' },
        { label: 'Nội dung', value: 'Sản phẩm, đánh giá, mẹo dùng' },
        { label: 'Mục tiêu', value: 'Giúp chọn mua thông minh hơn' },
      ]}
      sections={[
        {
          title: 'Những chủ đề thường cập nhật',
          description: 'TECH-SHOP ưu tiên các thông tin có ích cho người mua thiết bị công nghệ, từ sản phẩm mới đến thay đổi đáng chú ý của thị trường.',
          items: [
            'Ra mắt điện thoại, laptop, tablet và phụ kiện mới.',
            'So sánh tính năng, hiệu năng và mức giá giữa các dòng sản phẩm.',
            'Mẹo sử dụng, bảo quản và tối ưu thiết bị trong quá trình sử dụng.',
          ],
        },
        {
          title: 'Giá trị cho khách hàng',
          description: 'Nội dung được biên soạn ngắn gọn, dễ hiểu để khách hàng nắm nhanh thông tin cần thiết trước khi quyết định mua hàng.',
          items: [
            'Nắm xu hướng công nghệ đang được quan tâm.',
            'Dễ đối chiếu giữa nhu cầu thực tế và cấu hình sản phẩm.',
            'Tiết kiệm thời gian tìm kiếm thông tin rời rạc ở nhiều nơi.',
          ],
        },
      ]}
      contactLabel="Muốn xem nội dung công nghệ theo chủ đề?"
      contactValue="Hãy quay lại trang tin để theo dõi các bài viết và cập nhật mới trong thời gian tới."
    />
  );
};

export default TechNews;