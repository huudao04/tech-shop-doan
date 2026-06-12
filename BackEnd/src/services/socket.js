let ioInstance = null;

export const initSocket = (io) => {
	ioInstance = io;

	io.on('connection', (socket) => {
		console.log(`🔌 Thiết bị kết nối: ${socket.id}`);

		socket.on('join_room', (data) => {
			try {
				if (data?.role) socket.join(data.role);
				if (data?.userId) socket.join(data.userId);
				console.log(`👤 Người dùng ${data?.userId || '(không rõ)'} với quyền [${data?.role || 'guest'}] đã vào phòng.`);
			} catch (e) {
				console.error('Lỗi join_room:', e);
			}
		});

		socket.on('disconnect', () => {
			console.log(`❌ Thiết bị ngắt kết nối: ${socket.id}`);
		});
	});
};

export const getIo = () => ioInstance;

export const emitToRoom = (room, event, payload) => {
	if (!ioInstance) return false;
	try {
		ioInstance.to(room).emit(event, payload);
		return true;
	} catch (e) {
		console.error('Emit error:', e);
		return false;
	}
};

export const disconnectUserSockets = async (userId) => {
	if (!ioInstance) return 0;
	try {
		const sockets = await ioInstance.in(userId).fetchSockets();
		for (const s of sockets) {
			try { s.disconnect(true); } catch (e) { /* ignore per-socket errors */ }
		}
		return sockets.length;
	} catch (e) {
		console.error('disconnectUserSockets error:', e);
		return 0;
	}
};

export default {
	initSocket,
	getIo,
	emitToRoom
};
