import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { Badge, Button, Empty, List, Popover, Space, Typography } from 'antd';

const { Text, Paragraph } = Typography;

const NotificationBell = ({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onOpenNotification,
}) => {
  const content = (
    <div style={{ width: 380 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text strong>Thông báo</Text>
        <Button type="link" size="small" onClick={onMarkAllRead} disabled={!notifications.length}>
          Đánh dấu tất cả đã đọc
        </Button>
      </Space>

      {notifications.length === 0 ? (
        <Empty description="Chưa có thông báo" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
          <List
            size="small"
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                onClick={() => onOpenNotification?.(item)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 12px',
                  marginBottom: 8,
                  borderRadius: 10,
                  background: item.isRead ? '#fff' : '#f6ffed',
                  border: '1px solid #f0f0f0',
                }}
              >
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text strong style={{ fontSize: 13 }}>
                      {item.title}
                    </Text>
                    {!item.isRead && <CheckOutlined style={{ color: '#1677ff' }} />}
                  </Space>
                  <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, color: '#555' }}>
                    {item.message}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false}>
      <Badge count={unreadCount} overflowCount={99} size="small">
        <Button type="text" icon={<BellOutlined style={{ fontSize: 20 }} />} />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;