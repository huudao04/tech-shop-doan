import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const query = req.user.role === 'admin'
      ? { $or: [{ userId: null }, { userId: { $exists: false } }] }
      : { userId: req.user.id };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean(),
      Notification.countDocuments({ ...query, isRead: false })
    ]);

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải thông báo' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id, $or: [{ userId: null }, { userId: { $exists: false } }] }
      : { _id: req.params.id, userId: req.user.id };

    const notification = await Notification.findOneAndUpdate(query, { isRead: true }, { returnDocument: 'after' });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { $or: [{ userId: null }, { userId: { $exists: false } }] }
      : { userId: req.user.id };

    await Notification.updateMany(query, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể đánh dấu đã đọc' });
  }
};
